// The combo context window is read from two places — the combos dashboard
// (what the user sets) and /v1/models (what a client auto-detects). They used
// to be separate implementations with different conditions, so this suite
// pins the ONE shared rule rather than either call site.
import { describe, it, expect } from "vitest";
import { resolveComboContextWindow, hasContextOverride } from "@/shared/utils/comboContext";

describe("resolveComboContextWindow", () => {
  it("prefers an explicit positive override over the member maximum", () => {
    expect(resolveComboContextWindow({ contextWindow: 1_000_000 }, [200_000, 128_000])).toBe(1_000_000);
    // Even when the override is SMALLER than a member — it is explicit.
    expect(resolveComboContextWindow({ contextWindow: 64_000 }, [200_000])).toBe(64_000);
  });

  it("ignores a non-positive override instead of reporting 0", () => {
    // This is the divergence the two copies had: the dashboard rendered
    // "0K context" for these, the API fell back to the member maximum.
    expect(resolveComboContextWindow({ contextWindow: 0 }, [200_000])).toBe(200_000);
    expect(resolveComboContextWindow({ contextWindow: -1 }, [200_000])).toBe(200_000);
    expect(resolveComboContextWindow({ contextWindow: "0" }, [200_000])).toBe(200_000);
  });

  it("treats absent, null and non-numeric overrides as auto", () => {
    const members = [131_072];
    expect(resolveComboContextWindow({}, members)).toBe(131_072);
    expect(resolveComboContextWindow({ contextWindow: null }, members)).toBe(131_072);
    expect(resolveComboContextWindow({ contextWindow: undefined }, members)).toBe(131_072);
    // Number("") and Number(null) are 0 — they must not become an override of 0.
    expect(resolveComboContextWindow({ contextWindow: "" }, members)).toBe(131_072);
    expect(resolveComboContextWindow({ contextWindow: "auto" }, members)).toBe(131_072);
  });

  it("uses the largest member window when there is no override", () => {
    expect(resolveComboContextWindow({}, [128_000, 1_000_000, 200_000])).toBe(1_000_000);
  });

  it("skips members that declare no window", () => {
    expect(resolveComboContextWindow({}, [undefined, null, "nope", 42_000])).toBe(42_000);
  });

  it("returns null when nothing is known rather than inventing a number", () => {
    expect(resolveComboContextWindow({}, [])).toBeNull();
    expect(resolveComboContextWindow({}, [undefined, null])).toBeNull();
    expect(resolveComboContextWindow(null, [])).toBeNull();
  });

  it("floors a fractional override", () => {
    expect(resolveComboContextWindow({ contextWindow: 128_000.9 }, [])).toBe(128_000);
  });
});

describe("hasContextOverride", () => {
  it("is true only for an override the resolver would actually honour", () => {
    expect(hasContextOverride({ contextWindow: 1_000_000 })).toBe(true);
    expect(hasContextOverride({ contextWindow: 1 })).toBe(true);
  });

  it("is false for every value resolveComboContextWindow ignores", () => {
    // Otherwise the dashboard would print "(override)" next to a member maximum.
    expect(hasContextOverride({})).toBe(false);
    expect(hasContextOverride({ contextWindow: null })).toBe(false);
    expect(hasContextOverride({ contextWindow: undefined })).toBe(false);
    expect(hasContextOverride({ contextWindow: "" })).toBe(false);
    expect(hasContextOverride({ contextWindow: 0 })).toBe(false);
    expect(hasContextOverride({ contextWindow: -5 })).toBe(false);
    expect(hasContextOverride({ contextWindow: "auto" })).toBe(false);
    expect(hasContextOverride(null)).toBe(false);
  });

  it("agrees with the resolver on every input the pair sees", () => {
    const members = [200_000];
    for (const contextWindow of [undefined, null, "", "auto", 0, -1, 64_000, 1_000_000]) {
      const combo = { contextWindow };
      const claimed = hasContextOverride(combo);
      const effective = resolveComboContextWindow(combo, members);
      if (claimed) {
        expect(effective).toBe(Math.floor(Number(contextWindow)));
      } else {
        // An unclaimed combo must have fallen back to the members.
        expect(effective).toBe(200_000);
      }
    }
  });
});
