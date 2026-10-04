import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../../src/app/api/providers/suggested-models/route.js";
import { fetchSuggestedModels } from "../../src/shared/utils/providerModelsFetcher.js";

const UPSTREAM = "https://inference-api.nousresearch.com/v1/models";

// Live-shaped upstream payload: mixed pricing, no explicit free flags upstream.
const UPSTREAM_BODY = {
  data: [
    { id: "stepfun/step-3.7-flash:free", name: "Step 3.7 Flash", context_length: 262144, pricing: { prompt: "0", completion: "0" } },
    { id: "inclusionai/ling-3.1-flash", name: "Ling 3.1 Flash", context_length: 262144, pricing: { prompt: "0.0000000000", completion: "0" } },
    { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", context_length: 262144, pricing: { prompt: "0.0000006", completion: "0.0000024" } },
    { id: "mystery/no-pricing", name: "Mystery", context_length: 128000 },
  ],
};

const routeUrl = (extra = "") =>
  `http://localhost/api/providers/suggested-models?url=${encodeURIComponent(UPSTREAM)}&type=nous${extra}`;

describe("suggested-models route: freeOnly=1 (Free-only toggle)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => UPSTREAM_BODY })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("without freeOnly returns the full catalog with accurate free flags", async () => {
    const res = await GET(new Request(routeUrl()));
    const { data } = await res.json();
    expect(data.map((m) => m.id)).toEqual([
      "deepseek/deepseek-v4-flash",
      "inclusionai/ling-3.1-flash",
      "mystery/no-pricing",
      "stepfun/step-3.7-flash:free",
    ]);
    const byId = Object.fromEntries(data.map((m) => [m.id, m]));
    expect(byId["deepseek/deepseek-v4-flash"].free).toBe(false);
    expect(byId["mystery/no-pricing"].free).toBe(false);
    expect(byId["inclusionai/ling-3.1-flash"].free).toBe(true);
    expect(byId["stepfun/step-3.7-flash:free"].free).toBe(true);
  });

  it("freeOnly=1 narrows the result to free models only", async () => {
    const res = await GET(new Request(routeUrl("&freeOnly=1")));
    const { data } = await res.json();
    expect(data.map((m) => m.id)).toEqual([
      "inclusionai/ling-3.1-flash",
      "stepfun/step-3.7-flash:free",
    ]);
    for (const m of data) expect(m.free).toBe(true);
  });
});

describe("fetchSuggestedModels: freeOnly option (client side)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const wantsFree = String(input).includes("freeOnly=1");
        return {
          ok: true,
          json: async () => ({ data: wantsFree ? [{ id: "a/free" }] : [{ id: "a/free" }, { id: "a/paid" }] }),
        };
      })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends freeOnly=1 when checked, omits it when unchecked, caches each scope separately", async () => {
    // Unique url per run so the module-level 10-min cache can't leak across runs.
    const fetcher = { url: `${UPSTREAM}?run=${Date.now()}`, type: "nous" };

    const freeScope = await fetchSuggestedModels(fetcher, { freeOnly: true });
    expect(freeScope.map((m) => m.id)).toEqual(["a/free"]);
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain("freeOnly=1");

    const allScope = await fetchSuggestedModels(fetcher);
    expect(allScope.map((m) => m.id)).toEqual(["a/free", "a/paid"]);
    expect(String(globalThis.fetch.mock.calls[1][0])).not.toContain("freeOnly=1");

    // Second hit of each scope is served from its own cache entry (no fetch).
    await fetchSuggestedModels(fetcher, { freeOnly: true });
    await fetchSuggestedModels(fetcher);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
