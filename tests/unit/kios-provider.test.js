import { describe, it, expect } from "vitest";
import kios from "../../open-sse/providers/registry/kios.js";
import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "../../open-sse/config/providerModels.js";
import { FREE_PROVIDERS, resolveProviderId } from "../../src/shared/constants/providers.js";
import { resolveProviderAlias } from "../../open-sse/services/model.js";

describe("kios — official KiosAPI free provider", () => {
  it("is registered with free category + apikey auth (never noAuth: real keys must be used)", () => {
    expect(kios.id).toBe("kios");
    expect(kios.alias).toBe("kios");
    expect(kios.aliases).toEqual(["kiosapi", "kios-api"]);
    expect(kios.category).toBe("free");
    expect(kios.authType).toBe("apikey");
    expect(kios.authModes).toEqual(["apikey"]);
    // noAuth would make aroute inject a virtual keyless connection and IGNORE
    // the migrated account keys — it must stay falsy.
    expect(kios.noAuth).toBeUndefined();
    expect(kios.hasFree).toBe(true);
    expect(kios.passthroughModels).toBe(true);
  });

  it("points transport at the OpenAI-compatible endpoint", () => {
    expect(kios.transport.baseUrl).toBe("https://kiosapi.com/v1/chat/completions");
    // /v1/models rejects these token groups — no modelsFetcher/validateUrl.
    expect(kios.modelsFetcher).toBeUndefined();
    expect(kios.transport.validateUrl).toBeUndefined();
  });

  it("seeds all live Free-group models, flagged free, proven combo model first", () => {
    expect(kios.models).toHaveLength(37);
    expect(kios.models.every((m) => m.isFree === true)).toBe(true);
    expect(new Set(kios.models.map((m) => m.id)).size).toBe(37);
    expect(kios.models[0].id).toBe("mimo-v2.6-flash"); // combo mimotria member
    for (const m of kios.models) expect(m.name).toBeTruthy();
  });

  it("shows up in the built provider maps under every lookup token", () => {
    expect(FREE_PROVIDERS.kios).toBeTruthy();
    expect(FREE_PROVIDERS.kios.noAuth).toBeFalsy();
    expect(resolveProviderId("kios")).toBe("kios");
    // Extra aliases resolve through open-sse's provider-alias resolver — the
    // exact function parseModel uses before routing (src resolveProviderId
    // only knows id/alias, a pre-existing quirk shared with nous).
    expect(resolveProviderAlias("kios")).toBe("kios");
    expect(resolveProviderAlias("kiosapi")).toBe("kios");
    expect(resolveProviderAlias("kios-api")).toBe("kios");
    expect(PROVIDER_MODELS.kios).toHaveLength(37);
    expect(PROVIDER_ID_TO_ALIAS.kios).toBe("kios");
  });
});
