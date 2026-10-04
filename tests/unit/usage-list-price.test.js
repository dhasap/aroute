// Usage analytics: list-price estimates + readable provider names.
//
// Three things are covered here, each a bug the Usage page showed:
//   1. a model with no local price resolved to null -> stored cost stayed 0
//      forever, even though models.dev publishes a list price for it;
//   2. history recorded a custom node's id, and once that node was deleted
//      the page could only print the raw id;
//   3. stored costs were written once and never refreshed when rates arrived.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let nodesRepo;
let catalogOverride;
let pricing;

const NODE_ID = "openai-compatible-chat-11111111-2222-3333-4444-555555555555";

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aroute-usage-listprice-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
  nodesRepo = await import("@/lib/db/repos/nodesRepo.js");
  catalogOverride = await import("open-sse/providers/catalogOverride.js");
  pricing = await import("open-sse/providers/pricing.js");
});

afterAll(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

function writeCatalog(entry) {
  fs.writeFileSync(
    path.join(tempDir, "model-catalog.json"),
    JSON.stringify({ v: 1, syncedAt: Date.now(), models: {}, providers: {}, ...entry })
  );
  catalogOverride.invalidateCatalog();
}

describe("list price from the models.dev catalog", () => {
  it("is null before the catalog is installed, so a missing price stays visible as unknown", () => {
    pricing.setCatalogPricingSource(null);
    expect(pricing.getPricingForModel("kios", "totally-unknown-model")).toBeNull();
  });

  it("resolves a model that has no local entry at all", () => {
    writeCatalog({ pricing: { "mimo-v2.6-flash": { input: 0.14, output: 0.28, cached: 0.0028 } } });
    expect(catalogOverride.getCatalogPricing("mimo-v2.6-flash")).toMatchObject({
      input: 0.14, output: 0.28, cached: 0.0028,
    });

    pricing.setCatalogPricingSource(catalogOverride.getCatalogPricing);
    const resolved = pricing.getPricingForModel("kios", "mimo-v2.6-flash");
    expect(resolved).toMatchObject({ input: 0.14, output: 0.28 });
  });

  it("matches the way usage records a model: vendor prefix and :free are ignored", () => {
    writeCatalog({ pricing: { "step-3.7-flash": { input: 0.2, output: 1.15 } } });
    pricing.setCatalogPricingSource(catalogOverride.getCatalogPricing);
    expect(pricing.getPricingForModel("nous", "stepfun/step-3.7-flash:free")).toMatchObject({ input: 0.2 });
  });

  it("lets a hand-written canonical price win over the catalog", () => {
    writeCatalog({ pricing: { "claude-sonnet-4-6": { input: 999, output: 999 } } });
    pricing.setCatalogPricingSource(catalogOverride.getCatalogPricing);
    const resolved = pricing.getPricingForModel("claude", "claude-sonnet-4-6");
    expect(resolved.input).not.toBe(999);
    expect(resolved.input).toBeGreaterThan(0);
  });
});

describe("provider names stay readable after a node is deleted", () => {
  it("remembers the name of a deleted node", async () => {
    const created = await nodesRepo.createProviderNode({
      id: NODE_ID, type: "openai-compatible", name: "LegacyGateway",
      prefix: "lg", apiType: "chat", baseUrl: "https://example.invalid/v1",
    });
    expect(created.name).toBe("LegacyGateway");
    // A live node must not be reported as retired.
    expect(await nodesRepo.getRetiredProviderNames()).toEqual({});

    await nodesRepo.deleteProviderNode(NODE_ID);
    expect(await nodesRepo.getRetiredProviderNames()).toEqual({ [NODE_ID]: "LegacyGateway" });
  });

  it("drops the memory again when the node comes back", async () => {
    await nodesRepo.createProviderNode({
      id: NODE_ID, type: "openai-compatible", name: "LegacyGateway",
      prefix: "lg", apiType: "chat", baseUrl: "https://example.invalid/v1",
    });
    expect(await nodesRepo.getRetiredProviderNames()).toEqual({});
    await nodesRepo.deleteProviderNode(NODE_ID);
    expect(await nodesRepo.getRetiredProviderNames()).toEqual({ [NODE_ID]: "LegacyGateway" });
  });

  it("reports the name, not the id, in usage stats", async () => {
    await db.saveRequestUsage({
      provider: NODE_ID,
      model: "legacy-model",
      tokens: { prompt_tokens: 1000, completion_tokens: 500 },
      endpoint: "/v1/chat/completions",
      status: "ok",
    });

    const stats = await db.getUsageStats("24h");
    const entry = Object.values(stats.byModel).find((m) => m.rawModel === "legacy-model");
    expect(entry).toBeTruthy();
    expect(entry.provider).toBe("LegacyGateway");
    expect(entry.provider).not.toContain(NODE_ID);
  });
});

describe("recomputing stored costs", () => {
  it("refreshes history and the daily aggregates when a price arrives", async () => {
    // Written while the resolver knows nothing about this model.
    pricing.setCatalogPricingSource(null);
    await db.saveRequestUsage({
      provider: "kios",
      model: "priceless-model",
      tokens: { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 },
      endpoint: "/v1/chat/completions",
      status: "ok",
    });
    let hist = await db.getUsageHistory({ model: "priceless-model" });
    expect(hist).toHaveLength(1);
    expect(hist[0].cost).toBe(0);

    // The price shows up; recompute has to pick it up retroactively.
    writeCatalog({ pricing: { "priceless-model": { input: 2, output: 8 } } });
    pricing.setCatalogPricingSource(catalogOverride.getCatalogPricing);
    const result = await db.recomputeStoredCosts();
    expect(result.rows).toBeGreaterThan(0);
    expect(result.changed).toBeGreaterThan(0);

    hist = await db.getUsageHistory({ model: "priceless-model" });
    // 1M in @2 + 1M out @8
    expect(hist[0].cost).toBeCloseTo(10, 9);

    const stats = await db.getUsageStats("24h");
    expect(stats.totalCost).toBeGreaterThan(9);
    const dayKey = Object.keys(stats.byModel).find((k) => k.includes("priceless-model"));
    expect(dayKey).toBeTruthy();
    expect(stats.byModel[dayKey].cost).toBeCloseTo(10, 9);
  });

  it("is idempotent: a second run changes nothing", async () => {
    const first = await db.recomputeStoredCosts();
    expect(first.changed).toBe(0);
  });
});
