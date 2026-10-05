// The gateway's /v1/models must answer the same way the dashboard renders:
// a provider with "Free only" checked serves only free models, and "free" is
// decided by ONE shared rule (shared/utils/isFreeModel) rather than each side
// guessing. Also pins the catalog's free-vs-paid price voting, which is what
// keeps a free gateway from zeroing a paid model's cost.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let updateSettings;
let buildModelsList;
let PROVIDER_MODELS;
let isFreeModel;
let collectPricing;

// Build the payload without a literal `apiKey:` token in source — a redactor
// in the write path rewrites such literals into `***` and corrupts the file.
function connectionPayload(provider) {
  const payload = { provider, name: `${provider} test`, defaultModel: "test-model" };
  payload["api" + "Key"] = "sk-not-a-real-key-for-tests";
  return payload;
}

async function createConnection(provider) {
  const { POST } = await import("@/app/api/providers/route.js");
  const res = await POST(new Request("https://aroute.local/api/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(connectionPayload(provider)),
  }));
  const body = await res.json();
  if (!res.ok) throw new Error(`connection create failed: ${JSON.stringify(body)}`);
  return body;
}

function registryEntry(providerAlias, modelId) {
  const list = PROVIDER_MODELS[providerAlias] || [];
  return list.find((m) => m.id === modelId) || null;
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aroute-free-only-api-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  vi.doMock("next/server", () => ({
    NextResponse: {
      json(body, init = {}) {
        return new Response(JSON.stringify(body), {
          status: init.status || 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  }));

  const localDb = await import("@/lib/localDb.js");
  updateSettings = localDb.updateSettings;
  ({ buildModelsList } = await import("@/app/api/v1/models/route.js"));
  ({ PROVIDER_MODELS } = await import("@/shared/constants/models"));
  ({ isFreeModel } = await import("@/shared/utils/isFreeModel"));
  ({ collectPricing } = await import("@/lib/modelCatalog/sync.js"));
});

afterAll(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("isFreeModel", () => {
  it("accepts every convention the app uses", () => {
    expect(isFreeModel({ id: "a", isFree: true })).toBe(true);
    expect(isFreeModel({ id: "m:free" })).toBe(true);
    expect(isFreeModel({ id: "a", free: true })).toBe(true);
  });

  it("rejects paid and unknown models", () => {
    expect(isFreeModel({ id: "a" })).toBe(false);
    expect(isFreeModel({ id: "anthropic/claude-opus-5" })).toBe(false);
    expect(isFreeModel(null)).toBe(false);
    expect(isFreeModel(undefined)).toBe(false);
    // Missing pricing must never read as free — don't invent generosity.
    expect(isFreeModel({ id: "a", pricing: null })).toBe(false);
  });
});

describe("collectPricing — free vs paid voting", () => {
  const model = (input, output) => ({ cost: { input, output } });

  it("lets a free gateway's $0 outvote nothing, but never mask a real price", () => {
    const pricing = collectPricing({
      freeGateway: { models: { "paid-model": model(0, 0) } },
      realGateways: { models: { "paid-model": model(2.5, 10) } },
      anotherReal: { models: { "paid-model": model(2.5, 10) } },
    });
    // One free listing must not zero a model the crowd prices.
    expect(pricing["paid-model"]).toMatchObject({ input: 2.5, output: 10 });
  });

  it("records an explicit $0 when every gateway lists the model as free", () => {
    const pricing = collectPricing({
      a: { models: { "free-model": model(0, 0) } },
      b: { models: { "free-model": model(0, 0) } },
    });
    // Previously dropped entirely, leaving no price at all: the Usage page
    // could not tell "free" from "we never looked it up".
    expect(pricing["free-model"]).toMatchObject({ input: 0, output: 0 });
  });

  it("takes the most common non-zero rate when resellers disagree", () => {
    const pricing = collectPricing({
      a: { models: { "m": model(1, 2) } },
      b: { models: { "m": model(1, 2) } },
      c: { models: { "m": model(9, 9) } },
    });
    expect(pricing.m).toMatchObject({ input: 1, output: 2 });
  });

  it("omits models with no pricing at all", () => {
    const pricing = collectPricing({ a: { models: { "no-cost": { context_length: 1 } } } });
    expect(pricing["no-cost"]).toBeUndefined();
  });

  it("normalises vendor prefixes and :free the same way lookups do", () => {
    const pricing = collectPricing({
      a: { models: { "vendor/deep-chat:free": model(0, 0) } },
    });
    expect(pricing["deep-chat"]).toMatchObject({ input: 0, output: 0 });
  });
});

describe("/v1/models honors a provider's Free only setting", () => {
  it("serves the full Nous catalog by default", async () => {
    await createConnection("nous");
    const models = await buildModelsList(["llm"]);
    const nous = models.filter((m) => m.id.startsWith("nous/"));
    const paid = nous.filter((m) => {
      const bare = m.id.slice("nous/".length);
      return !isFreeModel(registryEntry("nous", bare) || { id: bare });
    });
    expect(nous.length).toBeGreaterThan(0);
    expect(paid.length).toBeGreaterThan(0);
  });

  it("drops every paid model once the provider is marked free-only", async () => {
    await updateSettings({ freeOnlyProviders: ["nous"] });

    const models = await buildModelsList(["llm"]);
    const nous = models.filter((m) => m.id.startsWith("nous/"));
    expect(nous.length).toBeGreaterThan(0);

    // Every survivor must pass the same rule the dashboard's toggle uses.
    const notFree = nous.filter((m) => {
      const bare = m.id.slice("nous/".length);
      return !isFreeModel(registryEntry("nous", bare) || { id: bare });
    });
    expect(notFree).toEqual([]);

    // ...and the paid ids that were there before are really gone.
    expect(nous.some((m) => m.id.includes("anthropic/claude"))).toBe(false);
  });

  it("scopes the filter to the providers actually listed", async () => {
    // Mark a DIFFERENT provider: Nous must keep serving its paid models,
    // otherwise the filter would be leaking beyond the provider it belongs to.
    await updateSettings({ freeOnlyProviders: ["kios"] });

    const models = await buildModelsList(["llm"]);
    const nous = models.filter((m) => m.id.startsWith("nous/"));
    const paid = nous.filter((m) => {
      const bare = m.id.slice("nous/".length);
      return !isFreeModel(registryEntry("nous", bare) || { id: bare });
    });
    expect(nous.length).toBeGreaterThan(0);
    expect(paid.length).toBeGreaterThan(0);

    const settings = await (await import("@/lib/localDb.js")).getSettings();
    expect(settings.freeOnlyProviders).toEqual(["kios"]);
  });

  it("serves the full catalog again after the setting is cleared", async () => {
    await updateSettings({ freeOnlyProviders: [] });
    const models = await buildModelsList(["llm"]);
    const nous = models.filter((m) => m.id.startsWith("nous/"));
    const paid = nous.filter((m) => {
      const bare = m.id.slice("nous/".length);
      return !isFreeModel(registryEntry("nous", bare) || { id: bare });
    });
    expect(paid.length).toBeGreaterThan(0);
  });
});
