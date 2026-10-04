// Fetch and cache suggested models for providers that expose a public models API
// Fetches via backend proxy to avoid CORS issues

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map(); // key: fetcher.url → { data, expiresAt }

/**
 * Fetch suggested models for a provider using its modelsFetcher config.
 * Results are cached in-memory for CACHE_TTL_MS (one entry per url+type+scope,
 * so the free-only and full-catalog variants of the same fetcher don't clobber
 * each other when the "Free only" toggle flips).
 * @param {{ url: string, type: string }} fetcher
 * @param {{ freeOnly?: boolean }} [opts] when true, asks the backend to narrow
 *   the result to free models only (route param freeOnly=1)
 * @returns {Promise<Array<{ id: string, name: string, contextLength?: number, free?: boolean }>>}
 */
export async function fetchSuggestedModels(fetcher, { freeOnly = false } = {}) {
  if (!fetcher?.url || !fetcher?.type) return [];

  const cacheKey = `${fetcher.url}|${fetcher.type}|${freeOnly ? "free" : "all"}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const params = new URLSearchParams({ url: fetcher.url, type: fetcher.type });
    if (freeOnly) params.set("freeOnly", "1");
    const res = await fetch(`/api/providers/suggested-models?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data ?? [];
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    return [];
  }
}
