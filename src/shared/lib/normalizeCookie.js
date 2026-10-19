/**
 * Cookie input normalizer for Gemini Web connections.
 * Accepts a cookie in ANY reasonable shape and returns the canonical
 * `name=value; name=value` string, or null if the required fields are absent.
 *
 * Supported inputs:
 *  - raw Cookie header ("__Secure-1PSID=...; __Secure-1PSIDTS=...; ...")
 *  - "Cookie: <header>" (with or without the prefix)
 *  - JSON string: {"__Secure-1PSID": "...", ...} or [{"name":"..","value":".."}, ...]
 *  - JSON string with a "cookie" field: {"cookie": "...", "name": "..."}
 *  - Set-Cookie style, one cookie per line
 *  - base64-encoded cookie (as produced by CLI helpers)
 *  - URL-encoded or whitespace/newline-mangled header strings
 *  - Pasted JSON request dump (e.g. from DevTools "Copy request headers")
 */
const REQUIRED = ["__Secure-1PSID", "__Secure-1PSIDTS"];

function tryParseJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function fromNameValueObject(obj) {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" || typeof v === "number") parts.push(`${k}=${v}`);
  }
  return parts.join("; ");
}

function fromArray(arr) {
  const parts = [];
  for (const item of arr) {
    if (item && typeof item === "object") {
      const n = item.name || item.Name || item.key;
      const v = item.value ?? item.Value;
      if (n && v != null) parts.push(`${n}=${v}`);
    } else if (typeof item === "string") {
      parts.push(item);
    }
  }
  return parts.join("; ");
}

function collectPairs(raw) {
  // Pull every "name=value" pair, tolerating newlines, stray quotes,
  // "Cookie:" prefixes and URL encoding.
  let s = String(raw || "");
  // If the whole string is one URL-encoded blob, decode it.
  if (/%3D|%3d/.test(s) && !s.includes("__Secure-")) {
    try { s = decodeURIComponent(s); } catch {}
  }
  const pairs = [];
  const re = /([A-Za-z0-9_$\-]+)=([^;\n\r]*?)(?=(?:;|\n|\r|$))/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const name = m[1].trim();
    let value = m[2].trim().replace(/^"|"$/g, "");
    if (!name || name.toLowerCase() === "cookie") continue;
    pairs.push(`${name}=${value}`);
  }
  return pairs;
}

export function normalizeCookieInput(input) {
  if (input == null) return { cookie: null, name: null, format: "empty" };

  // Non-string JSON payloads (object/array already parsed)
  if (typeof input === "object") {
    if (Array.isArray(input)) return { cookie: fromArray(input), name: null, format: "array" };
    if (typeof input.cookie === "string") {
      const inner = normalizeCookieInput(input.cookie);
      return { cookie: inner.cookie, name: input.name || inner.name, format: "object.cookie" };
    }
    return { cookie: fromNameValueObject(input), name: input.name || null, format: "object" };
  }

  let s = String(input).trim();
  if (!s) return { cookie: null, name: null, format: "empty" };
  let format = "raw";

  // base64 blob (long, no recognizable name= structure, decodes to something with 1PSID)
  if (/^[A-Za-z0-9+/=\s]{40,}$/.test(s) && !s.includes("__Secure-")) {
    try {
      const decoded = Buffer.from(s.replace(/\s+/g, ""), "base64").toString("utf8");
      if (decoded.includes("__Secure-1PSID")) {
        s = decoded;
        format = "base64";
      }
    } catch {}
  }

  // JSON string forms
  const j = tryParseJson(s);
  if (j !== null) {
    if (Array.isArray(j)) return { cookie: fromArray(j), name: null, format: "json.array" };
    if (typeof j === "object") {
      if (typeof j.cookie === "string") {
        const inner = normalizeCookieInput(j.cookie);
        return { cookie: inner.cookie, name: j.name || inner.name, format: "json.cookie" };
      }
      return { cookie: fromNameValueObject(j), name: j.name || null, format: "json.object" };
    }
  }

  // "Cookie: xxx" prefix from DevTools
  s = s.replace(/^\s*cookie\s*:\s*/i, "");
  // DevTools header dumps may contain other headers — keep from the first relevant pair onward
  const first = s.search(/__Secure-1PSID/i);
  if (first > 0) s = s.slice(first);

  const pairs = collectPairs(s);
  const joined = pairs.join("; ");
  if (!REQUIRED.every((r) => joined.includes(r + "="))) {
    return { cookie: null, name: null, format };
  }

  // Dedupe by name (last occurrence wins, like a browser cookie jar)
  const jar = new Map();
  for (const p of pairs) {
    const eq = p.indexOf("=");
    jar.set(p.slice(0, eq), p.slice(eq + 1));
  }
  const canonical = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  return { cookie: canonical, name: null, format };
}

export function cookieLooksValid(cookie) {
  return !!cookie && REQUIRED.every((r) => cookie.includes(r + "="));
}
