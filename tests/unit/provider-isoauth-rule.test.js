import { describe, it, expect } from "vitest";
import {
  OAUTH_PROVIDERS,
  FREE_PROVIDERS,
} from "../../src/shared/constants/providers.js";

// The provider detail page decides which connect form to render with
//   isOAuth = !!OAUTH_PROVIDERS[id] || !!providerInfo?.hasOAuth || authModes.includes("oauth")
// It used to also OR in FREE_PROVIDERS[id], which made EVERY `category: "free"`
// provider look OAuth-capable — so KiosAPI (free category, API-key auth) grew an
// OAuth button whose modal has no handler for it. This locks the contract.

/** Mirror the page's providerInfo lookup + isOAuth rule exactly. */
function pageIsOAuth(providerId) {
  const providerInfo =
    OAUTH_PROVIDERS[providerId] ||
    FREE_PROVIDERS[providerId] ||
    null;
  const authModes = providerInfo?.authModes || [];
  return (
    !!OAUTH_PROVIDERS[providerId] ||
    !!providerInfo?.hasOAuth ||
    authModes.includes("oauth")
  );
}

describe("isOAuth rule — driven by OAuth flow, not by category", () => {
  it("KiosAPI (free category, apikey auth) is NOT OAuth", () => {
    expect(FREE_PROVIDERS.kios).toBeTruthy(); // it IS in the free category
    expect(FREE_PROVIDERS.kios.authModes).toEqual(["apikey"]);
    expect(FREE_PROVIDERS.kios.noAuth).toBeUndefined(); // real API-key accounts
    expect(pageIsOAuth("kios")).toBe(false);
  });

  it("no free-category provider is treated as OAuth purely by being free", () => {
    const leaked = Object.keys(FREE_PROVIDERS).filter(
      (id) =>
        !FREE_PROVIDERS[id]?.noAuth &&
        !FREE_PROVIDERS[id]?.hasOAuth &&
        !(FREE_PROVIDERS[id]?.authModes || []).includes("oauth") &&
        pageIsOAuth(id),
    );
    expect(leaked).toEqual([]);
  });

  it("keyless free providers (mimo-free, opencode, devin-cli) stay keyless", () => {
    for (const id of ["mimo-free", "opencode", "devin-cli"]) {
      if (!FREE_PROVIDERS[id]) continue;
      expect(FREE_PROVIDERS[id].noAuth, `${id} should be noAuth`).toBe(true);
      expect(pageIsOAuth(id), `${id} must not render an OAuth form`).toBe(false);
    }
  });

  it("OAuth-in-free-category providers (kiro, gemini-cli) REMAIN OAuth", () => {
    for (const id of ["kiro", "gemini-cli"]) {
      expect(FREE_PROVIDERS[id], `${id} should still be free category`).toBeTruthy();
      expect(pageIsOAuth(id), `${id} must keep its OAuth connect form`).toBe(true);
    }
  });

  it("a provider with category 'oauth' is always OAuth", () => {
    for (const id of Object.keys(OAUTH_PROVIDERS)) {
      expect(pageIsOAuth(id), `${id} must be OAuth`).toBe(true);
    }
  });
});