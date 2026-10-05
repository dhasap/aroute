// Server-persisted per-provider "Free only" state.
//
// The toggle used to live only in localStorage, which meant the dashboard
// could render free-only while the gateway's /v1/models kept serving every
// paid model of that provider — two views of the same provider disagreeing by
// design. The server copy is the source of truth because that is what
// /v1/models reads; localStorage stays as the instant, offline UI mirror.

const KEY = "freeOnlyProviders";

function normalize(list) {
  return Array.isArray(list)
    ? [...new Set(list.filter((providerId) => typeof providerId === "string" && providerId.trim() !== ""))]
    : [];
}

/**
 * @returns {Promise<string[]|null>} enabled provider ids, or null when the
 *   settings could not be read (caller then falls back to localStorage).
 */
export async function loadFreeOnlyProviders() {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object") return null;
    return normalize(data[KEY]);
  } catch {
    return null;
  }
}

/**
 * Persist one provider's free-only state. Returns true only when the server
 * accepted it, so the caller can tell a real save from an offline toggle.
 *
 * @param {string} providerId
 * @param {boolean} enabled
 * @returns {Promise<boolean>}
 */
export async function setFreeOnlyProvider(providerId, enabled) {
  if (typeof providerId !== "string" || providerId.trim() === "") return false;
  try {
    const current = await loadFreeOnlyProviders();
    if (current === null) return false;
    const next = enabled
      ? [...current, providerId]
      : current.filter((id) => id !== providerId);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [KEY]: next }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
