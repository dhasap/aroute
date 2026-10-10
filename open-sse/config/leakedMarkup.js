// In-band tool-call markup that some upstream chat templates write into the TEXT
// channel instead of a structured `tool_calls` field.
//
// DeepSeek V4.x (dsml) encodes tool calls with special tokens delimited by the
// fullwidth vertical bar U+FF5C: <｜｜DSML｜｜tool_calls> … </｜｜DSML｜｜DSML｜>.
// When a relay extracts the calls but leaves a stub of that markup in `content`,
// clients render raw junk to the user ("<｜｜DSML｜｜DSML｜ calls>" — probed live
// 2026-10-11 on kios/deepseek-v4.1-flash-free: the SSE carried it as two deltas,
// "\n\n<" then "｜DSML｜ calls>\n", alongside correct tool_calls).
//
// Constants only; the scrubber that uses them lives in utils/leakedMarkup.js.

// Fullwidth vertical bar delimiting DeepSeek's special tokens (U+FF5C).
export const DSML_BAR = "\uFF5C";

// Marker word inside the bar pair.
export const DSML_NAME = "DSML";

const BAR_CLASS = `[${DSML_BAR}]`;

// Every proper prefix of the marker word ("D", "DS", "DSM", "DSML"), longest
// first so the alternation prefers the complete word.
function markerWordPrefixes(word) {
  const parts = [];
  for (let i = word.length; i >= 1; i--) parts.push(word.slice(0, i));
  return parts.join("|");
}

// A tail that could still grow into a marker: "<", "<｜", "<｜D", … "<｜｜DSML｜｜any…".
// Anything else ("<div", "<tool_calls>" in prose) is real text and is never held.
const PREFIXES = markerWordPrefixes(DSML_NAME);

export const LEAKED_MARKUP_PREFIX_RE = new RegExp(
  `^<${BAR_CLASS}?(?:${PREFIXES})?(?:${BAR_CLASS}[^>]*)?$`
);

// Complete tag-shaped leak: <｜｜DSML｜｜tool_calls> / <｜｜DSML｜calls>.
// The body never spans lines (a real tag body is one token run), so the match
// cannot swallow following prose.
export const LEAKED_MARKUP_TAG_RE = new RegExp(`<${BAR_CLASS}?${DSML_NAME}${BAR_CLASS}[^>\\n]*>`, "g");

// Marker whose shape was mangled on the wire: a bare bar-wrapped marker, or one
// whose tag body lost its leading "<" ("｜DSML｜ calls>" — the relay's own
// extraction leaves this stub behind). The body is optional and must terminate
// in ">", so prose that merely mentions the marker word survives.
export const LEAKED_MARKUP_STUB_RE = new RegExp(`(?:<)?${BAR_CLASS}?${DSML_NAME}${BAR_CLASS}(?:[^>\\n<]{0,48}>)?`, "g");

// A still-open tag at the very end of a buffer — nothing may follow it, so the
// scrubber waits for the closing ">" (and drops it when the stream ends).
export const LEAKED_MARKUP_OPEN_TAIL_RE = new RegExp(`<${BAR_CLASS}?${DSML_NAME}${BAR_CLASS}[^>\\n]*$`);

// Upper bound on how much text a streaming scrubber holds back while a marker may
// still be incomplete, so a "<" flood cannot stall the stream indefinitely.
export const LEAKED_MARKUP_MAX_HOLD = 96;
