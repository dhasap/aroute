import { beforeEach, describe, expect, it, vi } from "vitest";

// The combo's effective context window is the max over its members: a request
// that overflows a 200K member should still be advertised as routable because
// a 1M member can absorb it. /v1/models must expose that number in the
// snake_case clients look for, or they fall back to a small default and
// compact early.
const mocks = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  getCombos: vi.fn(),
  getCustomModels: vi.fn(),
  getModelAliases: vi.fn(),
  getDisabledModels: vi.fn(),
  updateProviderCredentials: vi.fn(),
  resolveConnectionProxyConfig: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  getCombos: mocks.getCombos,
  getCustomModels: mocks.getCustomModels,
  getModelAliases: mocks.getModelAliases,
}));
vi.mock("@/lib/disabledModelsDb", () => ({ getDisabledModels: mocks.getDisabledModels }));
vi.mock("@/sse/services/tokenRefresh", () => ({ updateProviderCredentials: mocks.updateProviderCredentials }));
vi.mock("@/lib/network/connectionProxy", () => ({ resolveConnectionProxyConfig: mocks.resolveConnectionProxyConfig }));

const { buildModelsList } = await import("../../src/app/api/v1/models/route.js");

const combos = (list) => mocks.getCombos.mockResolvedValue(list);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProviderConnections.mockResolvedValue([]);
  combos([]);
  mocks.getCustomModels.mockResolvedValue([]);
  mocks.getModelAliases.mockResolvedValue({});
  mocks.getDisabledModels.mockResolvedValue({});
});

describe("/v1/models combo context window", () => {
  it("advertises max member context for a combo with mixed windows", async () => {
    combos([{
      name: "aroute",
      models: ["kios/glm-5.3", "kios/glm-5.3-flash", "kios/qwen3.8-flash"],
    }]);

    const data = await buildModelsList(["llm"]);
    const combo = data.find((m) => m.id === "aroute");
    expect(combo).toBeTruthy();
    expect(combo.context_length).toBe(1_000_000); // glm-5.3-flash member
    expect(combo.capabilities.contextWindow).toBe(1_000_000);
    expect(combo.max_completion_tokens).toBe(131_072); // max over members
  });

  it("uses member max even when a small-window member is first in the list", async () => {
    combos([{ name: "c2", models: ["kios/qwen3.8-flash", "kios/glm-5.3"] }]);
    const combo = (await buildModelsList(["llm"])).find((m) => m.id === "c2");
    expect(combo.context_length).toBe(262_144); // max(262K, 200K), not first member
  });

  it("uses the floor context (200K) for members that resolve no window of their own", async () => {
    // getCapabilitiesForModel always returns a safe floor (contextWindow 200K),
    // so a fully-unknown member surfaces that floor, not undefined.
    combos([{ name: "mystery", models: ["zz/unknown-model-x"] }]);
    const combo = (await buildModelsList(["llm"])).find((m) => m.id === "mystery");
    expect(combo.context_length).toBe(200_000);
  });

  it("leaves webSearch combos untouched", async () => {
    combos([{ name: "web", kind: "webSearch", models: [] }]);
    const combo = (await buildModelsList(["webSearch", "webFetch"])).find((m) => m.id === "web");
    expect(combo.context_length).toBeUndefined();
    expect(combo.kind).toBe("webSearch");
  });
});
