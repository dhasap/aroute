// Single source of truth for a combo's effective context window.
//
// The rule used to be written twice — once in `/v1/models` (what Hermes reads)
// and once in the combos dashboard (what the user reads) — with different
// conditions: the API rejected a non-positive override, the dashboard did not,
// so an override of 0 rendered as "0K context" on the dashboard while the API
// reported the member maximum. Two copies of a rule always drift; one copy
// cannot.
//
// Rule: an explicit positive override wins, otherwise the largest context
// among the members that actually declare one, otherwise null (unknown — the
// caller then omits the field rather than inventing a number).

/**
 * @param {object|null} combo          combo row (uses `contextWindow`)
 * @param {Array<number|null|undefined>} memberContextWindows  per-member windows
 * @returns {number|null} effective window in tokens, or null when undeterminable
 */
export function resolveComboContextWindow(combo, memberContextWindows = []) {
  const raw = combo?.contextWindow;
  // Number(null) and Number("") are 0, which would read as a legitimate
  // override of zero — treat anything non-positive as "auto" instead.
  if (raw !== null && raw !== undefined && raw !== "") {
    const override = Number(raw);
    if (Number.isFinite(override) && override > 0) return Math.floor(override);
  }
  const finite = [];
  for (const value of memberContextWindows || []) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) finite.push(n);
  }
  return finite.length ? Math.max(...finite) : null;
}

/**
 * Whether the combo carries an explicit, usable override (drives the
 * "(override)" label on the dashboard, so it can never claim an override that
 * resolveComboContextWindow() actually ignored).
 *
 * @param {object|null} combo
 * @returns {boolean}
 */
export function hasContextOverride(combo) {
  const raw = combo?.contextWindow;
  if (raw === null || raw === undefined || raw === "") return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}
