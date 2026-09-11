import { NextResponse } from "next/server";
import { getProviderConnections } from "@/lib/localDb";
import { getProviderModels, PROVIDER_ID_TO_ALIAS } from "open-sse/config/providerModels.js";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { UPDATER_CONFIG } from "@/shared/constants/config";
import { pingModelByKind } from "@/app/api/models/test/ping";

// GET /api/models/test-all — POST /api/models/test-all
// Ping every model of every active provider connection through the internal
// /api/v1 endpoints (same path a real request takes). First model per provider
// warms up sequentially (token refresh race), the rest ping in parallel.
export async function POST() {
  return handle();
}

export async function GET() {
  return handle();
}

async function handle() {
  try {
    const connections = (await getProviderConnections()).filter((c) => c.isActive !== false);
    const baseUrl = `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort}`;

    const providersOut = [];
    let total = 0;
    let passed = 0;

    for (const conn of connections) {
      const providerId = conn.provider;
      const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
      let models = getProviderModels(alias);

      // Compatible providers keep models in the live catalog, not the static table.
      // Fetch the upstream /models directly — an internal HTTP hop to our own
      // /api/providers route would 401 (no dashboard JWT on server-side fetch).
      if (models.length === 0 && (isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId))) {
        const upstreamBase = String(conn.providerSpecificData?.baseUrl || "").replace(/\/+$/, "");
        if (upstreamBase) {
          try {
            const res = await fetch(`${upstreamBase}/models`, {
              headers: { Authorization: `Bearer ${conn.apiKey || ""}` },
              signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
              const payload = await res.json();
              const list = Array.isArray(payload) ? payload : (payload?.data || payload?.models || []);
              models = list
                .map((m) => ({ id: m.id || m.name || m.model }))
                .filter((m) => m.id);
            }
          } catch { /* fall through with empty */ }
        }
      }

      if (models.length === 0) {
        providersOut.push({ provider: providerId, connectionId: conn.id, results: [], summary: { total: 0, passed: 0, failed: 0 } });
        continue;
      }

      // Sequential warm-up (first model refreshes token if needed) then parallel pings.
      const [first, ...rest] = models;
      const ping = async (model) => {
        const kind = model.kind || model.type || "llm";
        const result = await pingModelByKind(`${alias}/${model.id}`, kind, baseUrl);
        return { modelId: model.id, name: model.name || model.id, ok: !!result.ok, latencyMs: result.latencyMs || 0, error: result.error || null };
      };

      let results;
      try {
        const firstResult = await ping(first);
        results = rest.length
          ? [firstResult, ...(await Promise.all(rest.map(ping)))]
          : [firstResult];
      } catch (err) {
        results = models.map((model) => ({ modelId: model.id, name: model.name || model.id, ok: false, latencyMs: 0, error: err.message }));
      }

      const p = results.filter((r) => r.ok).length;
      total += results.length;
      passed += p;
      providersOut.push({
        provider: providerId,
        connectionId: conn.id,
        results,
        summary: { total: results.length, passed: p, failed: results.length - p },
      });
    }

    return NextResponse.json({
      providers: providersOut,
      testedAt: new Date().toISOString(),
      summary: { total, passed, failed: total - passed, providers: providersOut.length },
    });
  } catch (error) {
    console.log("Error in test-all:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
