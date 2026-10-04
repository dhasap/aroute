import { describe, it, expect } from "vitest";
import { FILTERS, onlyFree } from "../../src/app/api/providers/suggested-models/filters.js";
import nous from "../../open-sse/providers/registry/nous.js";

// Fixture mirrors the live Nous Portal /v1/models shape (probed 2026-10-03):
// pricing strings, context_length, plus the failure modes we hit in real life.
const CATALOG = [
  { id: "stepfun/step-3.7-flash:free", name: "StepFun: Step 3.7 Flash", context_length: 262144, pricing: { prompt: "0.0000000000", completion: "0.0000000000" } },
  { id: "inclusionai/ling-3.1-flash", name: "InclusionAI: Ling 3.1 Flash", context_length: 262144, pricing: { prompt: "0", completion: "0" } },
  { id: "stealth/space-bunny-alpha", name: "Stealth: Space Bunny Alpha", context_length: 131072, pricing: { prompt: "0", completion: "0", input_cache_read: "0" } },
  { id: "meituan/longcat-2.5-preview:free", name: "Meituan: LongCat 2.5 Preview", context_length: 262144, pricing: { prompt: "0.0", completion: "0.0" } },
  // dead free ids — still zero-priced in the catalog, must be excluded
  { id: "inclusionai/ling-3.0-flash-fin:free", name: "dead fin", context_length: 131072, pricing: { prompt: "0", completion: "0" } },
  { id: "meituan/longcat-2.0:free", name: "delisted", context_length: 131072, pricing: { prompt: "0", completion: "0" } },
  // paid model — nonzero pricing
  { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", context_length: 262144, pricing: { prompt: "0.0000006", completion: "0.0000024" } },
  // batch variant of a free model — different product, excluded
  { id: "stepfun/step-3.7-flash:free:batch", name: "batch", context_length: 262144, pricing: { prompt: "0", completion: "0" } },
  // pricing absent — never invent generosity
  { id: "mystery/no-pricing", name: "mystery", context_length: 128000 },
];

describe("nous-free filter (auto-updating free model list)", () => {
  const result = FILTERS["nous-free"](CATALOG);

  it("returns only live free models: :free suffix or all-zero pricing", () => {
    expect(result.map((m) => m.id)).toEqual([
      "inclusionai/ling-3.1-flash",
      "meituan/longcat-2.5-preview:free",
      "stealth/space-bunny-alpha",
      "stepfun/step-3.7-flash:free",
    ]);
  });

  it("excludes known-dead free ids, batch variants, paid and pricing-less models", () => {
    const ids = result.map((m) => m.id);
    expect(ids).not.toContain("inclusionai/ling-3.0-flash-fin:free");
    expect(ids).not.toContain("meituan/longcat-2.0:free");
    expect(ids).not.toContain("stepfun/step-3.7-flash:free:batch");
    expect(ids).not.toContain("deepseek/deepseek-v4-flash");
    expect(ids).not.toContain("mystery/no-pricing");
  });

  it("maps name/contextLength and flags free: true for the badge", () => {
    for (const m of result) {
      expect(m.free).toBe(true);
      expect(m.name).toBeTruthy();
      expect(typeof m.contextLength).toBe("number");
    }
  });

  it("is defensive on non-array payloads (route sends [])", () => {
    expect(FILTERS["nous-free"]([])).toEqual([]);
    expect(FILTERS["nous-free"](null)).toEqual([]);
  });
});

describe("nous full-catalog filter (Free-only OFF) + onlyFree narrowing", () => {
  const full = FILTERS["nous"](CATALOG);

  it("returns every chat model (paid included) minus batch and dead ids", () => {
    expect(full.map((m) => m.id)).toEqual([
      "deepseek/deepseek-v4-flash",
      "inclusionai/ling-3.1-flash",
      "meituan/longcat-2.5-preview:free",
      "mystery/no-pricing",
      "stealth/space-bunny-alpha",
      "stepfun/step-3.7-flash:free",
    ]);
  });

  it("flags free accurately from pricing / id suffix", () => {
    const byId = Object.fromEntries(full.map((m) => [m.id, m.free]));
    expect(byId["inclusionai/ling-3.1-flash"]).toBe(true);
    expect(byId["stepfun/step-3.7-flash:free"]).toBe(true);
    expect(byId["deepseek/deepseek-v4-flash"]).toBe(false);
    expect(byId["mystery/no-pricing"]).toBe(false);
  });

  it("nous-free is exactly the free subset of the full catalog", () => {
    expect(FILTERS["nous-free"](CATALOG)).toEqual(full.filter((m) => m.free));
  });

  it("onlyFree narrows any filter output the way freeOnly=1 does", () => {
    expect(onlyFree(full).every((m) => m.free === true)).toBe(true);
    expect(onlyFree(full).length).toBe(4);
    expect(onlyFree([])).toEqual([]);
    expect(onlyFree(null)).toEqual([]);
  });
});

describe("nous registry wiring for the free-tier features", () => {
  it("modelsFetcher points at the live catalog: full type + mergeIntoList (page narrows via freeOnly=1)", () => {
    expect(nous.modelsFetcher).toEqual({
      url: "https://inference-api.nousresearch.com/v1/models",
      type: "nous",
      mergeIntoList: true,
    });
  });

  it("seeds every live-verified free model with isFree (FREE badge + Free-only toggle)", () => {
    const freeSeeds = nous.models.filter((m) => m.isFree);
    expect(freeSeeds.map((m) => m.id).sort()).toEqual([
      "inclusionai/ling-3.0-flash-sante:free",
      "inclusionai/ling-3.1-flash",
      "meituan/longcat-2.5-preview:free",
      "poolside/laguna-s-2.1:free",
      "poolside/laguna-xs-2.1:free",
      "stealth/space-bunny-alpha",
      "stepfun/step-3.7-flash:free",
    ]);
  });

  it("never seeds the dead free ids", () => {
    const ids = nous.models.map((m) => m.id);
    expect(ids).not.toContain("inclusionai/ling-3.0-flash-fin:free");
    expect(ids).not.toContain("meituan/longcat-2.0:free");
  });
});
