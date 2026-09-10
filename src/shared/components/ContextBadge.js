"use client";

import Tooltip from "./Tooltip";

// Human-readable context window badge: 1000000 -> "1M", 200000 -> "200K".
// Sits next to CapacityBadges so combos/model selectors show each model's
// capability-derived context limit (never a hardcoded universal number).
export function formatContextWindow(tokens) {
  const n = Number(tokens);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  return `${Math.round(n / 1000)}K`;
}

export default function ContextBadge({ contextWindow, className = "" }) {
  const label = formatContextWindow(contextWindow);
  if (!label) return null;
  return (
    <Tooltip text={`Context window: ${Number(contextWindow).toLocaleString()} tokens`}>
      <span
        aria-label={`Context window ${label} tokens`}
        className={`font-data text-[10px] leading-none px-1.5 py-0.5 rounded border border-border text-text-muted cursor-help ${className}`}
      >
        {label}
      </span>
    </Tooltip>
  );
}
