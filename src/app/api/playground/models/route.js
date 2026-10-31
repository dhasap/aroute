/**
 * GET /api/playground/models — dashboard-authenticated model list for the
 * Playground. The public /api/v1/models requires an API key when reached
 * remotely (dashboardGuard treats /api/v1 as LLM API), so the browser-facing
 * playground fetches through this internal proxy instead. Reuses the exact
 * same builder, so the payload is identical.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { GET: modelsGET } = await import("@/app/api/v1/models/route.js");
    const res = await modelsGET(new Request("http://localhost/internal/models", { method: "GET" }));
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error?.message || "Failed to load models", type: "server_error" } },
      { status: 500 }
    );
  }
}
