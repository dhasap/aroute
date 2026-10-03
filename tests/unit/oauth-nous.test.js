// Nous Research OAuth (Nous Portal device-code) wiring.
// Live Portal call is opt-in: NOUS_LIVE=1 npx vitest run unit/oauth-nous.test.js
import { describe, it, expect } from "vitest";
import { PROVIDERS, PROVIDER_OAUTH } from "../../open-sse/config/providers.js";
import { getProvider, requestDeviceCode, pollForToken } from "@/lib/oauth/providers";
import { refreshAccessToken } from "../../open-sse/services/tokenRefresh/providers.js";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS, AI_PROVIDERS } from "@/shared/constants/providers";

// Intercepts fetch; runs the real refresh path; returns what would hit the wire.
async function captureRefresh(provider, refreshToken) {
  const realFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ access_token: "at", refresh_token: "rt_new", expires_in: 3600 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await refreshAccessToken(provider, refreshToken, {}, { info() {}, warn() {}, error() {}, debug() {} });
  } finally {
    globalThis.fetch = realFetch;
  }
  return captured;
}

describe("nous OAuth wiring", () => {
  it("registry oauth block lands in PROVIDER_OAUTH + transport injection", () => {
    expect(PROVIDER_OAUTH.nous).toBeTruthy();
    expect(PROVIDER_OAUTH.nous.clientId).toBe("hermes-cli");
    expect(PROVIDER_OAUTH.nous.deviceCodeUrl).toContain("/api/oauth/device/code");
    expect(PROVIDER_OAUTH.nous.refreshUrl).toContain("/api/oauth/token");
    expect(PROVIDER_OAUTH.nous.scope).toBe("inference:invoke");
    // OAUTH_INJECT_FIELDS: clientId + tokenUrl auto-injected into transport
    expect(PROVIDERS.nous.clientId).toBe("hermes-cli");
    expect(PROVIDERS.nous.tokenUrl).toContain("/api/oauth/token");
    // dual auth: OAuth + API key both offered in the UI (registry drives grouping)
    const entry = REGISTRY.find((r) => r.id === "nous");
    expect(entry.category).toBe("oauth");
    expect(entry.hasOAuth).toBe(true);
    expect(entry.authModes).toEqual(["oauth", "apikey"]);
    // UI grouping: OAuth tab offers the Portal login, authModes keeps the API-key form available
    expect(OAUTH_PROVIDERS.nous).toBeTruthy();
    expect(OAUTH_PROVIDERS.nous.authModes).toEqual(["oauth", "apikey"]);
    expect(AI_PROVIDERS.nous).toBeTruthy();
    expect(APIKEY_PROVIDERS.nous).toBeUndefined(); // category moved to oauth — apikey form via authModes
  });

  it("oauth provider handler registered with device_code flow", () => {
    const p = getProvider("nous");
    expect(p.flowType).toBe("device_code");
    expect(typeof p.requestDeviceCode).toBe("function");
    expect(typeof p.pollToken).toBe("function");
    expect(typeof p.mapTokens).toBe("function");
    expect(p.config.clientId).toBe("hermes-cli");
  });

  it.runIf(process.env.NOUS_LIVE)("requestDeviceCode hits the live Portal", async () => {
    const data = await requestDeviceCode("nous", undefined, {});
    expect(data.device_code).toBeTruthy();
    expect(data.user_code).toBeTruthy();
    expect(data.verification_uri_complete || data.verification_uri).toContain("portal.nousresearch.com");
    expect(data.expires_in).toBeGreaterThan(0);
  }, 20000);

  it("pollToken maps authorization_pending (HTTP 400 RFC shape) as pending, not failure", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "authorization_pending" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    try {
      const p = getProvider("nous");
      const res = await p.pollToken(p.config, "dc_fake");
      expect(res.ok).toBe(true);
      expect(res.data.error).toBe("authorization_pending");
      // generic wrapper reports pending, never a hard failure
      const wrapped = await pollForToken("nous", "dc_fake", null, null);
      expect(wrapped.success).toBe(false);
      expect(wrapped.pending).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("pollToken success → mapTokens connection shape", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          access_token: "at_test",
          refresh_token: "rt_test",
          expires_in: 3600,
          scope: "inference:invoke",
          token_type: "Bearer",
          inference_base_url: "https://inference-api.nousresearch.com/v1",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    try {
      const wrapped = await pollForToken("nous", "dc_fake", null, null);
      expect(wrapped.success).toBe(true);
      expect(wrapped.tokens.accessToken).toBe("at_test");
      expect(wrapped.tokens.refreshToken).toBe("rt_test");
      expect(wrapped.tokens.expiresIn).toBe(3600);
      expect(wrapped.tokens.providerSpecificData.authMethod).toBe("device_code");
      expect(wrapped.tokens.providerSpecificData.inferenceBaseUrl).toContain("inference-api");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("refresh: x-nous-refresh-token header, NO refresh_token in body (single-use token)", async () => {
    const captured = await captureRefresh("nous", "rt_rotate");
    expect(captured.url).toContain("portal.nousresearch.com/api/oauth/token");
    expect(captured.init.headers["x-nous-refresh-token"]).toBe("rt_rotate");
    const params = Object.fromEntries(captured.init.body);
    expect(params.grant_type).toBe("refresh_token");
    expect(params.client_id).toBe("hermes-cli");
    expect(params.refresh_token).toBeUndefined();

    // other providers unaffected: kimi still sends refresh_token in the body
    const kimi = await captureRefresh("kimi", "rt_k");
    const kimiParams = Object.fromEntries(kimi.init.body);
    expect(kimiParams.refresh_token).toBe("rt_k");
  });
});