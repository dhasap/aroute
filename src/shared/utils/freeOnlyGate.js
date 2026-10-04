// Shared rule for the provider page's "Free only" toggle.
//
// The toggle only earns its place when the catalog actually MIXES free and paid
// models. An all-free provider (KiosAPI — every Free-group model is flagged
// free) would show a control that can never hide anything, which reads as broken.
//
// The same rule has to drive every consumer of `freeOnly`, otherwise they drift:
// the render gate, the model-list filter, the suggested-models fetch, and the
// Test-All sweep all read `freeOnly`, and a checked value whose toggle is not
// even rendered leaves the user with no way to un-check it (Test All then
// reports "No free models to test" on a provider whose models are all free).

/**
 * @param {object} input
 * @param {number} input.freeCount    models that qualify as free
 * @param {number} input.paidCount    models that do not
 * @param {number} input.customCount  user-added custom model rows (count as "other")
 * @param {boolean} input.freeOnly    the raw checked state
 * @returns {{hasFreeModels: boolean, effectiveFreeOnly: boolean}}
 */
export function computeFreeOnlyGate({
  freeCount = 0,
  paidCount = 0,
  customCount = 0,
  freeOnly = false,
} = {}) {
  const hasFreeModels = freeCount > 0 && (paidCount > 0 || customCount > 0);
  return {
    hasFreeModels,
    effectiveFreeOnly: freeOnly && hasFreeModels,
  };
}