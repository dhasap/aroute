import { describe, it, expect, vi, beforeEach } from "vitest";

// The provider "test connection" endpoint dispatches on a hardcoded switch of
// provider ids. Any registry provider without its own case used to fall into
// `default: "Provider test not supported"` — that is what KiosAPI hit, and what
// any future provider would hit too. It now has a generic registry-driven fallback.

const getConnection = vi.fn();
const updateConnection = vi.fn();

vi.mock("@/lib/localDb", () => ({
  getProviderConnectionById: (id) => getConnection(id),
  updateProviderConnection: (id, patch) => updateConnection(id, patch),
}));

vi.mock("@/lib/network/connectionProxy", () => ({
  resolveConnectionProxyConfig: async () => ({ connectionProxyEnabled: false }),
}));

vi.mock("@/lib/network/proxyTest", () => ({ testProxyUrl: async () => ({ ok: true }) }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { testSingleConnection } = await import("../../src/app/api/providers/[id]/test/testUtils.js");

function conn(provider, extra = {}) {
  return {
    id: "c1",
    provider,
    authType: "apikey",
    apiKey: "sk-test",
    providerSpecificData: {},
    ...extra,
  };
}

const res = (status) => ({ ok: status >= 200 && status < 300, status, json: async () => ({}) });

describe("provider connection test — registry-driven fallback (no hardcoded case needed)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    updateConnection.mockReset();
    getConnection.mockReset();
  });

  it("KiosAPI: valid key → tested via chat endpoint, no 'not supported'", async () => {
    getConnection.mockResolvedValue(conn("kios"));
    mockFetch.mockResolvedValue(res(200));

    const out = await testSingleConnection("c1");

    expect(out.valid).toBe(true);
    expect(out.error).toBeNull();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://kiosapi.com/v1/chat/completions");
    expect(opts.method).toBe("POST");
    // seeded free default model
    expect(JSON.parse(opts.body).model).toBe("mimo-v2.6-flash");
    expect(updateConnection).toHaveBeenCalled();
  });

  it("KiosAPI: bad key (403) → invalid 'Invalid API key', never 'not supported'", async () => {
    getConnection.mockResolvedValue(conn("kios"));
    mockFetch.mockResolvedValue(res(403));

    const out = await testSingleConnection("c1");

    expect(out.valid).toBe(false);
    expect(out.error).toBe("Invalid API key");
    expect(out.error).not.toBe("Provider test not supported");
  });

  it("KiosAPI: unauthorized (401) → invalid", async () => {
    getConnection.mockResolvedValue(conn("kios"));
    mockFetch.mockResolvedValue(res(401));

    const out = await testSingleConnection("c1");

    expect(out.valid).toBe(false);
    expect(out.error).toBe("Invalid API key");
  });

  it("Nous: prefers the registry validateUrl (catalog) endpoint", async () => {
    getConnection.mockResolvedValue(conn("nous"));
    mockFetch.mockResolvedValue(res(200));

    const out = await testSingleConnection("c1");

    expect(out.valid).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toBe("https://inference-api.nousresearch.com/v1/models");
  });

  it("a custom-compat node still keeps its /models probe behaviour", async () => {
    getConnection.mockResolvedValue(
      conn("openai-compatible-chat-test", { providerSpecificData: { baseUrl: "https://example.com/v1" } }),
    );
    mockFetch.mockResolvedValue(res(200));

    const out = await testSingleConnection("c1");

    expect(out.valid).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toBe("https://example.com/v1/models");
  });

  it("Nous (OAuth): probes the chat endpoint instead of 'not supported'", async () => {
    getConnection.mockResolvedValue(
      conn("nous", { authType: "oauth", accessToken: "at-1", refreshToken: "rt-1" }),
    );
    mockFetch.mockResolvedValue(res(200));

    const out = await testSingleConnection("c1");

    expect(out.valid).toBe(true);
    expect(out.error).toBeNull();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://inference-api.nousresearch.com/v1/chat/completions");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer at-1");
    // tiny free model — a paid id would 404 with insufficient_credits
    expect(JSON.parse(opts.body).model).toBe("stepfun/step-3.7-flash:free");
  });

  it("Nous (OAuth): bad token (401) → invalid, not 'not supported'", async () => {
    getConnection.mockResolvedValue(
      conn("nous", { authType: "oauth", accessToken: "at-bad", refreshToken: "rt-1" }),
    );
    mockFetch.mockResolvedValue(res(401));

    const out = await testSingleConnection("c1");

    expect(out.valid).toBe(false);
    expect(out.error).not.toBe("Provider test not supported");
  });

  it("still reports 'not supported' when the provider has no endpoint at all", async () => {
    getConnection.mockResolvedValue(conn("totally-unknown-provider-xyz"));
    mockFetch.mockReset();

    const out = await testSingleConnection("c1");

    expect(out).toMatchObject({ valid: false, error: "Provider test not supported" });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});