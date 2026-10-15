// TalkNova usage/rate-limit tracker.
//
// Docs ("Rate Limits & Usage", talknova.site/docs): TalkNova meters usage per
// API key with monthly USD allowances per model family (text pools), calendar
// reset on the 1st of each month UTC, plus a feature pool for images.
//
//   GET https://talknova.site/v1/usage   (Authorization header, api key)
//
// Response shape (verified against TalkNova's own dashboard frontend, which
// renders the same usage object it fetches with the account session):
//   {
//     plan: "free",
//     claudeUsage: { usedUsd, limitUsd, remainingUsd, reservedUsd, unlimited,
//                    messageCount, period: "monthly" },
//     chatgptUsage: { ... },            // "GPT" family
//     kimiUsage:    { ... },
//     deepseekUsage:{ ... },
//     featureUsage: { image: { used, limit, remaining }, video: {...},
//                     tts: {...}, stt: {...} }
//   }
// (shape verified against a live key on 2026-10-13)
// Legacy field aliases exist (opusUsage, lunaUsage) — both are accepted here.
//
// The parser is intentionally tolerant: if TalkNova renames/reshapes fields we
// still surface whatever usage families we can find instead of failing.

import { proxyAwareFetch } from "../../utils/proxyFetch.js";

const USAGE_URL = "https://talknova.site/v1/usage";
const AUTH_SCHEME = "Bearer";

// Docs: usage pools reset on the 1st of each month, UTC.
function nextMonthUTCStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function toFinite(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

// Family fields → quota label (first present alias wins).
const FAMILIES = [
  { label: "Claude", keys: ["claudeUsage", "opusUsage"] },
  { label: "GPT", keys: ["chatgptUsage", "lunaUsage"] },
  { label: "Kimi", keys: ["kimiUsage"] },
  { label: "DeepSeek", keys: ["deepseekUsage"] },
];

function familyTier(data, family) {
  for (const key of family.keys) {
    if (data[key] && typeof data[key] === "object") return data[key];
  }
  return null;
}

// Display names for known feature pools (falls back to Capitalized key).
const POOL_LABELS = { image: "Image", video: "Video", tts: "TTS", stt: "STT" };

export async function getTalknovaUsage(apiKey, proxyOptions = null) {
  if (!apiKey || !apiKey.trim()) {
    return { message: "TalkNova API key not available. Add a key to track usage." };
  }

  const response = await proxyAwareFetch(
    USAGE_URL,
    {
      method: "GET",
      headers: {
        "Authorization": AUTH_SCHEME + " " + apiKey.trim(),
        Accept: "application/json",
      },
    },
    proxyOptions,
  );

  if (response.status === 401 || response.status === 403) {
    return {
      plan: "TalkNova (auth failed)",
      message: "TalkNova rejected the API key (invalid or revoked).",
    };
  }

  if (!response.ok) {
    return {
      plan: "TalkNova",
      message: `TalkNova usage endpoint returned HTTP ${response.status}.`,
    };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { plan: "TalkNova", message: "TalkNova usage endpoint returned invalid JSON." };
  }

  const quotas = {};

  for (const family of FAMILIES) {
    const tier = familyTier(data, family);
    if (!tier) continue;

    if (tier.unlimited === true) {
      quotas[`${family.label} (USD)`] = {
        used: (toFinite(tier.usedUsd) ?? 0) + (toFinite(tier.reservedUsd) ?? 0),
        total: toFinite(tier.limitUsd) ?? 0,
        unlimited: true,
        resetAt: nextMonthUTCStart(),
      };
      continue;
    }

    const used = toFinite(tier.usedUsd);
    const total = toFinite(tier.limitUsd);
    if (used === null && total === null) continue;
    // TalkNova's own dashboard folds reservedUsd (in-flight requests) into the
    // usage bar: bar% = (usedUsd + reservedUsd) / limitUsd. Mirror that here.
    const reserved = toFinite(tier.reservedUsd) ?? 0;

    quotas[`${family.label} (USD)`] = {
      used: (used ?? 0) + reserved,
      total: total ?? 0,
      resetAt: nextMonthUTCStart(),
    };
  }

  // Verified live shape: featureUsage pools include image/video/tts/stt.
  // Surface every pool with a real limit; skip empty ones (e.g. video on Free).
  for (const [poolName, pool] of Object.entries(data?.featureUsage ?? {})) {
    if (!pool || typeof pool !== "object") continue;
    const limit = toFinite(pool.limit);
    if (limit === null || limit <= 0) continue;
    const remaining = toFinite(pool.remaining);
    const label = POOL_LABELS[poolName] || (poolName.charAt(0).toUpperCase() + poolName.slice(1));
    quotas[label] = {
      used: remaining !== null ? Math.max(0, limit - remaining) : (toFinite(pool.used) ?? 0),
      total: limit,
      resetAt: nextMonthUTCStart(),
    };
  }

  if (Object.keys(quotas).length === 0) {
    return {
      plan: data?.plan ?? "TalkNova",
      message: "TalkNova usage returned no recognizable quota data.",
    };
  }

  return { plan: data?.plan ?? "TalkNova", quotas };
}
