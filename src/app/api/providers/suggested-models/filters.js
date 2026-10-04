// Free OpenCode models that don't use the "-free" id suffix
const KNOWN_FREE_OPENCODE_MODELS = ["big-pickle"];

// Upstream returns "Model is unavailable" for this id (2026-09-02) — re-enable when fixed
const DEAD_FREE_OPENCODE_MODELS = new Set(["deepseek-v4-flash-free"]);

// Nous Portal zero-price ids that no longer serve completions (probed 2026-10-03):
// fin:free -> 404 "Couldn't find that"; longcat-2.0:free -> 404 "no longer free"
const DEAD_FREE_NOUS_MODELS = new Set([
  "inclusionai/ling-3.0-flash-fin:free",
  "meituan/longcat-2.0:free",
]);

// A model is free when every pricing slot is exactly zero (missing pricing is
// NOT free — don't invent generosity the catalog never claimed).
const isZeroPricing = (pricing) =>
  !!pricing &&
  Object.keys(pricing).length > 0 &&
  Object.values(pricing).every((value) => {
    const n = Number(value);
    return Number.isFinite(n) && n === 0;
  });

export const FILTERS = {
  "openrouter-free": (models) =>
    models
      .filter(
        (m) =>
          m.pricing?.prompt === "0" &&
          m.pricing?.completion === "0" &&
          m.context_length >= 200000
      )
      .map((m) => ({ id: m.id, name: m.name, contextLength: m.context_length, free: true }))
      .sort((a, b) => b.contextLength - a.contextLength),

  "opencode-free": (models) =>
    models
      .filter((m) => (m.id?.endsWith("-free") || KNOWN_FREE_OPENCODE_MODELS.includes(m.id)) && !DEAD_FREE_OPENCODE_MODELS.has(m.id))
      .map((m) => ({ id: m.id, name: m.id, free: true })),

  // models.dev returns a large catalog; keep only mimo models
  "mimo-free": (models) =>
    (Array.isArray(models) ? models : [])
      .filter((m) => m.id?.startsWith("mimo") || m.name?.toLowerCase().includes("mimo"))
      .map((m) => ({ id: m.id, name: m.name || m.id, free: true })),

  "airforce-free": (models) =>
    (Array.isArray(models) ? models : [])
      .filter((m) => (m.tier === "free" || m.id?.endsWith(":free")) && m.supports_chat === true && (!m.media_type || m.media_type === "chat" || m.media_type === "text"))
      .map((m) => ({ id: m.id, name: m.name || m.id, contextLength: m.context_length, free: true }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),

  // Full Nous Portal chat catalog (free + paid) — fetched when the Free-only
  // filter is OFF so every model tracks the live catalog. Each entry carries
  // `free` (zero-priced pricing or the :free id convention) so consumers can
  // tell what is actually free right now; known-dead ids and :batch variants
  // (async batch product, not chat) are dropped.
  nous: (models) =>
    (Array.isArray(models) ? models : [])
      .filter((m) => m.id && !m.id.includes(":batch") && !DEAD_FREE_NOUS_MODELS.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length,
        free: m.id.endsWith(":free") || isZeroPricing(m.pricing),
      }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),

  // Nous Portal free tier rotates every few days: return ONLY the models that
  // are free right now (what the dashboard fetches when Free-only is ON), so
  // new free ids appear and dead ones drop without a registry reseed.
  "nous-free": (models) => FILTERS["nous"](models).filter((m) => m.free),
};

// Narrow any filter's output to free-only (route param freeOnly=1). Every
// filter marks its free entries with `free: true`, so this is safe for all types.
export const onlyFree = (models) => (Array.isArray(models) ? models : []).filter((m) => m.free === true);
