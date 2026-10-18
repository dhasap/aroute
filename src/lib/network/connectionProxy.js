import { getProxyPoolById } from "@/models";

// Safely normalize any value into a trimmed string.
function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

// ─── Proxy pool rotation state (in-memory) ─────────────────────────
const rotateState = new Map(); // providerId → { index }

// Health tracking per pool URL (measured: OpenCode admission 403s are
// egress-IP-bound and flap; the proxy vendor 407-bursts after rapid
// CONNECTs). Pools that recently failed get benched; pools with recent
// success are preferred. Feedback is reported from the opencode executor.
const POOL_COOLDOWN_MS = 90_000;
const POOL_STICKY_MS = 300_000;
const poolHealth = new Map(); // proxyUrl → { lastOk: 0, lastFail: 0, cooldownUntil: 0, ok: 0, fail: 0 }

function poolHealthEntry(proxyUrl) {
  let e = poolHealth.get(proxyUrl);
  if (!e) {
    e = { lastOk: 0, lastFail: 0, cooldownUntil: 0, ok: 0, fail: 0 };
    poolHealth.set(proxyUrl, e);
  }
  return e;
}

/** Record an attempt outcome for a proxy URL (called by provider executors). */
export function reportPoolResult(proxyUrl, ok) {
  if (!proxyUrl) return;
  const e = poolHealthEntry(proxyUrl);
  const now = Date.now();
  if (ok) {
    e.ok++;
    e.lastOk = now;
    e.cooldownUntil = 0;
  } else {
    e.fail++;
    e.lastFail = now;
    e.cooldownUntil = now + POOL_COOLDOWN_MS;
  }
}

/**
 * Pick one proxy pool ID from a list based on strategy.
 * round-robin: cycle over health-ordered live pools — benched (recently
 *              403'd/407'd) pools are skipped while others exist; pools
 *              with recent success come first (sticky-good). In-memory,
 *              resets on restart.
 * random:      uniform random pick
 * none/single: return first entry
 */
export function pickProxyPoolId(poolIds, strategy, providerId, getUrl = null) {
  if (!poolIds || poolIds.length === 0) return null;
  if (poolIds.length === 1) return poolIds[0];

  if (strategy === "round-robin") {
    const now = Date.now();
    const rank = (id) => {
      const e = getUrl ? poolHealth.get(getUrl(id)) : null;
      if (!e) return 1; // unknown → neutral
      if (e.cooldownUntil > now) return 2; // benched
      if (now - e.lastOk < POOL_STICKY_MS) return 0; // sticky-good
      return 1;
    };
    const ordered = poolIds
      .map((id) => ({ id, r: rank(id) }))
      .sort((a, b) => a.r - b.r)
      .map((s) => s.id);
    const live = ordered.filter((id) => rank(id) < 2);
    const pool = live.length ? live : ordered; // all cooling → keep cycling
    const state = rotateState.get(providerId) || { index: -1 };
    state.index = (state.index + 1) % pool.length;
    rotateState.set(providerId, state);
    return pool[state.index];
  }

  if (strategy === "random") {
    return poolIds[Math.floor(Math.random() * poolIds.length)];
  }

  return poolIds[0]; // "none" or unknown
}

/**
 * Normalize legacy proxy configuration.
 */
function normalizeLegacyProxy(providerSpecificData = {}) {
  const connectionProxyEnabled =
    providerSpecificData?.connectionProxyEnabled === true;

  const connectionProxyUrl = normalizeString(
    providerSpecificData?.connectionProxyUrl
  );

  const connectionNoProxy = normalizeString(
    providerSpecificData?.connectionNoProxy
  );

  return {
    connectionProxyEnabled,
    connectionProxyUrl,
    connectionNoProxy,
  };
}

/** Is this URL currently benched? */
export function isPoolCoolingDown(proxyUrl) {
  if (!proxyUrl) return false;
  const e = poolHealth.get(proxyUrl);
  return !!e && e.cooldownUntil > Date.now();
}

// Full pool URL list, refreshed whenever auth selection runs (auth.js).
let poolCandidateUrls = [];

export function recordPoolCandidates(urls) {
  if (Array.isArray(urls) && urls.length) poolCandidateUrls = urls;
}

/** Pick a different pool URL, excluding the given one. Preference: known-good
 * (recent 200) → any not-on-cooldown → null. Unknown pools qualify: with 100
 * mostly-unused pools, "no history" is a fine bet — better than retrying a
 * just-benched IP. */
export function pickHealthyPoolExcluding(excludeUrl, candidates = []) {
  const now = Date.now();
  const pool = candidates.length ? candidates : (poolCandidateUrls.length ? poolCandidateUrls : [...poolHealth.keys()]);
  const live = pool.filter((url) => url !== excludeUrl && !(poolHealth.get(url)?.cooldownUntil > now));
  if (!live.length) return null;
  const good = live.filter((url) => (poolHealth.get(url)?.lastOk || 0) > 0);
  if (good.length) {
    good.sort((a, b) => (poolHealth.get(b)?.lastOk || 0) - (poolHealth.get(a)?.lastOk || 0));
    return good[0];
  }
  return live[Math.floor(Math.random() * live.length)];
}

/**
 * Resolve final proxy configuration.
 *
 * Priority:
 * 1. Proxy Pool
 * 2. Legacy Proxy
 * 3. No Proxy
 */
export async function resolveConnectionProxyConfig(
  providerSpecificData = {}
) {
  try {
    const proxyPoolIdRaw = normalizeString(
      providerSpecificData?.proxyPoolId
    );

    // "__none__" means explicitly disabled
    const proxyPoolId =
      proxyPoolIdRaw === "__none__" ? "" : proxyPoolIdRaw;

    const legacy = normalizeLegacyProxy(providerSpecificData);

    /**
     * -----------------------------
     * Proxy Pool Resolution
     * -----------------------------
     */
    if (proxyPoolId) {
      const proxyPool = await getProxyPoolById(proxyPoolId);

      const proxyUrl = normalizeString(proxyPool?.proxyUrl);
      const noProxy = normalizeString(proxyPool?.noProxy);

      const isValidPool =
        proxyPool &&
        proxyPool.isActive === true &&
        proxyUrl;

      if (isValidPool) {
        /**
         * Vercel/Cloudflare relay proxies use base URL rewriting
         * instead of HTTP_PROXY environment variables.
         */
        if (proxyPool.type === "vercel" || proxyPool.type === "cloudflare" || proxyPool.type === "deno") {
          return {
            source: proxyPool.type,

            proxyPoolId,
            proxyPool,

            connectionProxyEnabled: false,
            connectionProxyUrl: "",
            connectionNoProxy: noProxy,

            strictProxy: proxyPool.strictProxy === true,

            vercelRelayUrl: proxyUrl, // Still mapped to vercelRelayUrl in the unified payload since they use the exact same header spec
          };
        }

        /**
         * Standard proxy pool
         */
        return {
          source: "pool",

          proxyPoolId,
          proxyPool,

          connectionProxyEnabled: true,
          connectionProxyUrl: proxyUrl,
          connectionNoProxy: noProxy,

          strictProxy: proxyPool.strictProxy === true,
        };
      }
    }

    /**
     * -----------------------------
     * Legacy Proxy Fallback
     * -----------------------------
     */
    if (
      legacy.connectionProxyEnabled &&
      legacy.connectionProxyUrl
    ) {
      return {
        source: "legacy",

        proxyPoolId: proxyPoolId || null,
        proxyPool: null,

        ...legacy,
      };
    }

    /**
     * -----------------------------
     * No Proxy Config
     * -----------------------------
     */
    return {
      source: "none",

      proxyPoolId: proxyPoolId || null,
      proxyPool: null,

      ...legacy,
    };
  } catch (error) {
    console.error(
      "[resolveConnectionProxyConfig] Failed to resolve proxy config:",
      error
    );

    return {
      source: "error",

      proxyPoolId: null,
      proxyPool: null,

      connectionProxyEnabled: false,
      connectionProxyUrl: "",
      connectionNoProxy: "",

      strictProxy: false,
    };
  }
}
