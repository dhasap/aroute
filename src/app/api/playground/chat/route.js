import { handleChat } from "@/sse/handlers/chat.js";
import { getApiKeys } from "@/lib/localDb";
import { initTranslators } from "open-sse/translator/index.js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initTranslators();
    initialized = true;
  }
}

/**
 * Resolve an internal API key for the playground proxy.
 * Routes through the same /v1 auth path (requireApiKey) without ever exposing
 * the key to the browser: the value lives only server-side and is attached to
 * the forwarded request's Authorization header.
 */
async function resolveInternalApiKey() {
  const keys = await getApiKeys();
  const active = (keys || []).filter((k) => k.isActive);
  if (!active.length) return null;
  return active[0].key;
}

/**
 * POST /api/playground/chat — dashboard-authenticated proxy into the /v1
 * chat completions engine. Accepts the same body as /v1/chat/completions and
 * streams the same SSE/text response back.
 */
export async function POST(request) {
  try {
    await ensureInitialized();

    const apiKey = await resolveInternalApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "No active API key configured. Create one under Endpoint & Key." },
        { status: 503 }
      );
    }

    // Rebuild the request with the internal key; the original dashboard cookie
    // never reaches handleChat (it reads auth from headers only).
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${apiKey}`);
    const ua = request.headers.get("user-agent");
    if (ua) headers.set("user-agent", ua);

    const upstreamRequest = new Request(request.url, {
      method: "POST",
      headers,
      body: await request.text(),
    });

    return await handleChat(upstreamRequest);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Playground chat failed" },
      { status: 500 }
    );
  }
}
