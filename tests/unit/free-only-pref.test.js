import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFreeOnlyPref, writeFreeOnlyPref, FREE_ONLY_STORAGE_KEY } from "../../src/shared/utils/freeOnlyPref.js";

// Minimal localStorage stand-in — enough surface for the helper.
const makeStorage = () => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _store: store,
  };
};

describe("freeOnlyPref (Free-only toggle persists across refresh)", () => {
  beforeEach(() => {
    globalThis.window = { localStorage: makeStorage() };
  });

  afterEach(() => {
    delete globalThis.window;
    vi.restoreAllMocks();
  });

  it("defaults to false when nothing was saved (pre-persistence behaviour)", () => {
    expect(readFreeOnlyPref()).toBe(false);
  });

  it("round-trips the checked state", () => {
    expect(writeFreeOnlyPref(true)).toBe(true);
    expect(readFreeOnlyPref()).toBe(true);
    expect(writeFreeOnlyPref(false)).toBe(true);
    expect(readFreeOnlyPref()).toBe(false);
  });

  it("stores under the documented key", () => {
    writeFreeOnlyPref(true);
    expect(globalThis.window.localStorage.getItem(FREE_ONLY_STORAGE_KEY)).toBe("true");
  });

  it("returns false when storage is unavailable (SSR / blocked)", () => {
    delete globalThis.window;
    expect(readFreeOnlyPref()).toBe(false);
    expect(writeFreeOnlyPref(true)).toBe(false);
  });

  it("never throws when localStorage throws (privacy mode)", () => {
    globalThis.window = {
      localStorage: {
        getItem: () => { throw new Error("SecurityError"); },
        setItem: () => { throw new Error("SecurityError"); },
      },
    };
    expect(readFreeOnlyPref()).toBe(false);
    expect(writeFreeOnlyPref(true)).toBe(false);
  });
});
