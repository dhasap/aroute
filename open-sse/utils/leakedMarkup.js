// Scrubber for in-band tool-call markup that upstreams leak into the text
// channel (see config/leakedMarkup.js for the format and the live probe).
//
// Used by the SSE stream layer (utils/stream.js) and by the JSON assemblers, so
// a client never renders "<｜｜DSML｜｜ calls>" — or a fragment of it — as assistant
// prose while the real tool calls arrive in tool_calls.
//
// Streaming is the reason this is stateful: the marker split across deltas, e.g.
// "\n\n<" then "｜DSML｜ calls>\n", so a scrubber holds back a tail that could still
// grow into a marker and releases it with the next delta.
import {
  DSML_NAME,
  LEAKED_MARKUP_PREFIX_RE,
  LEAKED_MARKUP_OPEN_TAIL_RE,
  LEAKED_MARKUP_STUB_RE,
  LEAKED_MARKUP_TAG_RE,
  LEAKED_MARKUP_MAX_HOLD,
} from "../config/leakedMarkup.js";
import { FORMATS } from "../translator/formats.js";

/**
 * Remove every complete leak marker from a string. Safe on plain prose (a fast
 * path exits on any text that carries no marker word at all).
 * @param {string} text
 * @returns {string}
 */
export function scrubLeakedMarkup(text) {
  if (typeof text !== "string" || text.length === 0) return typeof text === "string" ? text : "";
  // Both patterns require the marker word, so text without it cannot match.
  if (!text.includes(DSML_NAME)) return text;
  return text.replace(LEAKED_MARKUP_TAG_RE, "").replace(LEAKED_MARKUP_STUB_RE, "");
}

/**
 * End-of-stream variant: an unterminated marker ("<｜｜DSML｜｜ calls" with no ">")
 * has no more bytes coming, so drop the open tag instead of waiting for it.
 * @param {string} text
 * @returns {string}
 */
export function scrubLeakedMarkupTail(text) {
  if (typeof text !== "string" || text.length === 0) return "";
  return scrubLeakedMarkup(text.replace(LEAKED_MARKUP_OPEN_TAIL_RE, ""));
}

// Index of the "<" that starts a tail that is still a marker prefix, or -1 when
// the whole string can be released.
function heldTailStart(text) {
  const idx = text.lastIndexOf("<");
  if (idx === -1) return -1;
  const tail = text.slice(idx);
  if (tail.length > LEAKED_MARKUP_MAX_HOLD) return -1;
  return LEAKED_MARKUP_PREFIX_RE.test(tail) ? idx : -1;
}

/**
 * Stateful scrubbing for a text stream: push() deltas, flush() at end of stream.
 * A single instance belongs to a single stream (it carries the held tail).
 */
export function createLeakedMarkupScrubber() {
  let held = "";
  return {
    /** @param {string} text @returns {string} text safe to send downstream */
    push(text) {
      if (typeof text !== "string" || text.length === 0) return "";
      const combined = held + text;
      const cut = heldTailStart(combined);
      if (cut === -1) {
        held = "";
        return scrubLeakedMarkup(combined);
      }
      held = combined.slice(cut);
      return scrubLeakedMarkup(combined.slice(0, cut));
    },
    /**
     * Release whatever is still held when the stream ends. A held tail that is
     * not an (unterminated) marker is real text and is returned so the caller can
     * forward it; a marker fragment comes back empty.
     * @returns {string}
     */
    flush() {
      const tail = held;
      held = "";
      return scrubLeakedMarkupTail(tail);
    },
  };
}

// Apply the scrubber to one content field; returns the replacement value.
function scrubField(scrubber, text) {
  if (typeof text !== "string" || text.length === 0) return text;
  return scrubber ? scrubber.push(text) : scrubLeakedMarkup(text);
}

// Replace a field's value in place, dropping it when nothing survives the scrub.
function scrubInPlace(holder, key) {
  if (!holder || typeof holder[key] !== "string" || holder[key].length === 0) return false;
  const clean = scrubLeakedMarkup(holder[key]);
  if (clean === holder[key]) return false;
  if (clean) holder[key] = clean;
  else delete holder[key];
  return true;
}

/**
 * Scrub the assistant text of a complete (non-streaming) response body, in place.
 * The whole message is in hand here, so a marker split across stream deltas is
 * contiguous and one string pass removes it — no streaming state needed.
 * Covers the OpenAI, Claude, Gemini-family and Responses shapes.
 * @param {object} body provider-format response body (mutated)
 * @returns {boolean} true when anything changed
 */
export function scrubResponseText(body) {
  if (!body || typeof body !== "object") return false;
  let changed = false;

  for (const choice of body.choices || []) {
    if (scrubInPlace(choice?.message, "content")) changed = true;
  }
  for (const block of Array.isArray(body.content) ? body.content : []) {
    if (block?.type === "text" && scrubInPlace(block, "text")) changed = true;
  }
  for (const candidate of body.candidates || []) {
    for (const part of candidate?.content?.parts || []) {
      if (scrubInPlace(part, "text")) changed = true;
    }
  }
  for (const item of body.output || []) {
    for (const block of item?.content || []) {
      if (scrubInPlace(block, "text")) changed = true;
    }
  }
  if (typeof body.output_text === "string" && scrubInPlace(body, "output_text")) changed = true;

  return changed;
}


/**
 * Scrub the text channel of a provider-format chunk in place.
 *
 * @param {object} chunk provider-format SSE chunk (mutated)
 * @param {object|null} scrubber streaming scrubber, or null for whole-string scrubbing
 * @param {string} format FORMATS value of the PROVIDER (target) format
 * @returns {boolean} true when content changed — the caller must re-serialize
 *   the chunk instead of forwarding the raw upstream line
 */
export function scrubChunkContent(chunk, scrubber, format) {
  if (!chunk || typeof chunk !== "object") return false;
  let changed = false;

  if (format === FORMATS.OPENAI) {
    for (const choice of chunk.choices || []) {
      const delta = choice?.delta;
      if (!delta) continue;
      if (typeof delta.content === "string" && delta.content.length > 0) {
        const clean = scrubField(scrubber, delta.content);
        if (clean !== delta.content) {
          changed = true;
          // An emptied content field is dropped rather than sent as "" — a
          // zero-length delta carries no information and upsets SDK reasoning
          // tracking (same class of bug as the empty tool_calls array above).
          if (clean) delta.content = clean;
          else delete delta.content;
        }
      }
    }
    return changed;
  }

  if (format === FORMATS.CLAUDE) {
    const delta = chunk.delta;
    if (delta && typeof delta.text === "string" && delta.text.length > 0) {
      const clean = scrubField(scrubber, delta.text);
      if (clean !== delta.text) {
        changed = true;
        if (clean) delta.text = clean;
        else delete delta.text;
      }
    }
    return changed;
  }

  if (format === FORMATS.GEMINI || format === FORMATS.ANTIGRAVITY || format === FORMATS.GEMINI_CLI || format === FORMATS.VERTEX) {
    for (const candidate of chunk.candidates || []) {
      for (const part of candidate?.content?.parts || []) {
        if (typeof part?.text !== "string" || part.text.length === 0) continue;
        const clean = scrubField(scrubber, part.text);
        if (clean !== part.text) {
          changed = true;
          if (clean) part.text = clean;
          else delete part.text;
        }
      }
    }
    return changed;
  }

  return changed;
}
