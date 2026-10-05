// One rule for "is this model free?", shared by the provider detail page and
// the gateway's /v1/models list. It used to exist only inside the provider
// page, so the API had no way to answer the same question and listed every
// paid Nous model even with "Free only" checked.
//
// A model counts as free when:
//   - the registry flags it `isFree` (live-verified free tier, e.g. Kios's 37
//     models and Nous's rotating free set), or
//   - the live catalog marks the entry `free: true` (suggested-models
//     filters), or
//   - its id carries the `:free` suffix convention.
//
// Missing pricing is deliberately NOT treated as free — don't invent
// generosity the catalog never claimed.

/**
 * @param {{isFree?: boolean, free?: boolean, id?: string}|null|undefined} model
 * @returns {boolean}
 */
export function isFreeModel(model) {
  return (
    !!model?.isFree ||
    model?.free === true ||
    (typeof model?.id === "string" && model.id.endsWith(":free"))
  );
}
