import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import kios from "../../open-sse/providers/registry/kios.js";
import { PROVIDER_MODELS } from "../../open-sse/config/providerModels.js";
import { getModelKind } from "../../src/shared/constants/models.js";
import { computeFreeOnlyGate } from "../../src/shared/utils/freeOnlyGate.js";
import { isFreeModel } from "../../src/shared/utils/isFreeModel.js";

// Guards two real bugs on the provider detail page, both by EXECUTING the
// statements lifted from the page source (never by re-deriving them — a
// mirror-style test passed while the page itself was broken):
//
//   1. TDZ: `hasFreeModels` read `customRows` before its declaration, in a cycle
//      through `effectiveFreeOnly` → ReferenceError while rendering. It also
//      made eslint's react-hooks rules bail out, hiding the problem from lint.
//   2. Test All reported "No free models to test" on KiosAPI because
//      `isFreeNow` only ever received `{ id }`, dropping the registry `isFree`
//      flag, so the ":free" suffix became the only way to qualify — and Kios
//      ids are plain (`mimo-v2.6-flash`).

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = join(here, "../../src/app/(dashboard)/dashboard/providers/[id]/page.js");
const src = readFileSync(PAGE, "utf8");

function slice(startRe, endRe) {
  const start = src.search(startRe);
  if (start < 0) throw new Error(`start marker not found: ${startRe}`);
  const relEnd = src.slice(start).search(endRe);
  if (relEnd < 0) throw new Error(`end marker not found: ${endRe}`);
  const lineEnd = src.indexOf("\n", start + relEnd);
  return src.slice(start, lineEnd + 1);
}

const renderBlockSrc = slice(/const liveFreeEntries = /, /const freeShownCount = /);
const testAllBlockSrc = slice(/const liveFreeSet = suggestedModels\.length > 0/, /const ids = applyFreeFilter/);

/** Build runners over the real statements and invoke them. */
const factory = new Function(
  "computeFreeOnlyGate",
  "getModelKind",
  "isFreeModel",
  `
  const runRender = function (allModels, customModelRows, suggestedModels, disabledModelIds, freeOnly) {
    ${renderBlockSrc}
    return {
      hasFreeModels, effectiveFreeOnly, displayModels, customRows, freeShownCount,
      freeCount: freeList.length, paidCount: paidList.length,
    };
  };
  const runTestAll = function (models, customModelRows, kiloFreeModels, suggestedModels, freeOnly) {
    ${testAllBlockSrc}
    return { ids, candidates, applyFreeFilter, usedLiveSet: liveFreeSet !== null };
  };
  return { runRender, runTestAll };
  `,
);
const { runRender, runTestAll } = factory(computeFreeOnlyGate, getModelKind, isFreeModel);

const runPageBlock = (opts) =>
  runRender(opts.allModels ?? [], opts.customModelRows ?? [], opts.suggestedModels ?? [], opts.disabledModelIds ?? [], opts.freeOnly ?? false);

const mk = (id, isFree) => ({ id, ...(isFree ? { isFree: true } : {}) });
const kiosModels = () => kios.models.map((m) => ({ id: m.id, isFree: m.isFree === true }));
const mixedCatalog = () => [
  ...Array.from({ length: 7 }, (_, i) => mk(`free-${i}`, true)),
  ...Array.from({ length: 12 }, (_, i) => mk(`paid-${i}`, false)),
];

describe("Free-only toggle — visibility (registry facts)", () => {
  it("KiosAPI seed is entirely free (37/37), so nothing could ever be hidden", () => {
    expect(kios.models).toHaveLength(37);
    expect(PROVIDER_MODELS.kios).toHaveLength(37);
    expect(PROVIDER_MODELS.kios.every((m) => m.isFree === true)).toBe(true);
  });

  it("KiosAPI ids carry no ':free' suffix (the convention Test All used to require)", () => {
    expect(PROVIDER_MODELS.kios.some((m) => m.id.endsWith(":free"))).toBe(false);
    expect(PROVIDER_MODELS.kios.map((m) => m.id)).toContain("mimo-v2.6-flash");
  });

  it("Nous mixes free and paid, so the toggle has work to do", () => {
    const models = PROVIDER_MODELS.nous;
    const free = models.filter((m) => m.isFree === true || m.id.endsWith(":free"));
    const paid = models.filter((m) => !(m.isFree === true || m.id.endsWith(":free")));
    expect(free.length).toBeGreaterThan(0);
    expect(paid.length).toBeGreaterThan(free.length);
  });
});

describe("Test All selection — executes the real page statements", () => {
  it("extracted both blocks (a refactor must not silently skip this test)", () => {
    expect(renderBlockSrc).toContain("hasFreeModels");
    expect(renderBlockSrc).toContain("customRows");
    expect(renderBlockSrc).toContain("liveFreeEntries");
    expect(testAllBlockSrc).toContain("modelById");
    expect(testAllBlockSrc).toContain("isFreeNow");
    expect(testAllBlockSrc).toContain("applyFreeFilter");
    // "free" is now one shared module (src/shared/utils/isFreeModel.js) used by
    // this page AND /v1/models, so exercise the real import instead of slicing
    // a local copy out of the page — the local copy no longer exists.
    expect(isFreeModel({ id: "mimo-v2.6-flash", isFree: true })).toBe(true);
    expect(isFreeModel({ id: "stepfun/step-3.7-flash:free" })).toBe(true);
    expect(isFreeModel({ id: "anthropic/claude-opus-5" })).toBe(false);
  });

  it("BUG #2: KiosAPI with Free-only checked sweeps ALL 37 models, not none", () => {
    const out = runTestAll(kiosModels(), [], [], [], true);
    expect(out.ids).toHaveLength(37);
    expect(out.ids).toContain("mimo-v2.6-flash");
    expect(out.ids).toContain("glm-5.3-flash-free");
  });

  it("KiosAPI without Free-only also sweeps all 37", () => {
    expect(runTestAll(kiosModels(), [], [], [], false).ids).toHaveLength(37);
  });

  it("a plain id that is NOT flagged free is still excluded", () => {
    const out = runTestAll([mk("free-a", true), mk("paid-b", false)], [], [], [], true);
    expect(out.ids).toEqual(["free-a"]);
  });

  it("ids using the ':free' suffix qualify even without a registry flag", () => {
    const models = [{ id: "stepfun/step-3.7-flash:free" }, { id: "deepseek/deepseek-v4-flash" }];
    expect(runTestAll(models, [], [], [], true).ids).toEqual(["stepfun/step-3.7-flash:free"]);
  });

  it("live free set (modelsFetcher) wins over the registry flags", () => {
    const out = runTestAll([mk("a", true), mk("b", true)], [], [], [{ id: "b", free: true }], true);
    expect(out.usedLiveSet).toBe(true);
    expect(out.ids).toEqual(["b"]);
  });

  it("all-free catalog: a saved toggle cannot empty the sweep", () => {
    const out = runTestAll(kiosModels(), [], [], [], true);
    expect(out.applyFreeFilter).toBe(false);
    expect(out.ids).toHaveLength(37);
  });

  it("pure-paid catalog: a saved toggle cannot empty the sweep either", () => {
    const out = runTestAll([mk("p1", false), mk("p2", false)], [], [], [], true);
    expect(out.applyFreeFilter).toBe(false);
    expect(out.ids).toHaveLength(2);
  });

  it("mixed catalog with Free-only checked narrows to the free models", () => {
    expect(runTestAll(mixedCatalog(), [], [], [], true).ids).toHaveLength(7);
    expect(runTestAll(mixedCatalog(), [], [], [], false).ids).toHaveLength(19);
  });

  it("custom rows are swept too", () => {
    expect(runTestAll([], [{ id: "my-custom-model" }], [], [], false).ids).toEqual(["my-custom-model"]);
  });
});

describe("Free-only gate render — executes the real page statements", () => {
  it("extracted the render block", () => {
    expect(renderBlockSrc).toContain("hasFreeModels");
    expect(renderBlockSrc).toContain("customRows");
    expect(renderBlockSrc).toContain("liveFreeEntries");
    expect(renderBlockSrc).toContain("computeFreeOnlyGate");
  });

  it("BUG #1: does not throw the TDZ ReferenceError that crashed the page", () => {
    expect(() => runPageBlock({ allModels: [mk("x", true), mk("y", false)], freeOnly: true })).not.toThrow();
  });

  it("KiosAPI: toggle hidden, stale checked state normalized off, nothing hidden", () => {
    const out = runPageBlock({ allModels: kiosModels(), freeOnly: true });
    expect(out.hasFreeModels).toBe(false);
    expect(out.effectiveFreeOnly).toBe(false);
    expect(out.displayModels).toHaveLength(37);
    expect(out.paidCount).toBe(0);
  });

  it("mixed catalog: toggle shows and checking it narrows the list", () => {
    const off = runPageBlock({ allModels: mixedCatalog(), freeOnly: false });
    expect(off.hasFreeModels).toBe(true);
    expect(off.displayModels).toHaveLength(19);

    const on = runPageBlock({ allModels: mixedCatalog(), freeOnly: true });
    expect(on.effectiveFreeOnly).toBe(true);
    expect(on.displayModels).toHaveLength(7);
    expect(on.displayModels.every((m) => m.isFree)).toBe(true);
  });

  it("custom rows keep the toggle alive on an all-free seed", () => {
    const out = runPageBlock({ allModels: kiosModels(), customModelRows: [{ id: "user-model" }], freeOnly: false });
    expect(out.hasFreeModels).toBe(true);
  });

  it("pure-paid provider: toggle hidden, list intact", () => {
    const out = runPageBlock({ allModels: [mk("p1", false), mk("p2", false)], freeOnly: true });
    expect(out.hasFreeModels).toBe(false);
    expect(out.displayModels).toHaveLength(2);
  });
});

describe("computeFreeOnlyGate (the shared rule)", () => {
  it("needs at least one free model", () => {
    expect(computeFreeOnlyGate({ freeCount: 0, paidCount: 5, freeOnly: true })).toEqual({
      hasFreeModels: false,
      effectiveFreeOnly: false,
    });
  });
  it("needs something to hide", () => {
    expect(computeFreeOnlyGate({ freeCount: 5, paidCount: 0, customCount: 0, freeOnly: true }).hasFreeModels).toBe(false);
    expect(computeFreeOnlyGate({ freeCount: 5, paidCount: 3, freeOnly: true }).effectiveFreeOnly).toBe(true);
    expect(computeFreeOnlyGate({ freeCount: 5, paidCount: 0, customCount: 1, freeOnly: true }).hasFreeModels).toBe(true);
  });
  it("unchecked stays unchecked", () => {
    expect(computeFreeOnlyGate({ freeCount: 5, paidCount: 3, freeOnly: false }).effectiveFreeOnly).toBe(false);
  });
});