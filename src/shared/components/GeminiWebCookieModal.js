"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Modal, Button } from "@/shared/components";

/**
 * Gemini Web Cookie Authentication Modal
 * Accepts a cookie in ANY reasonable shape: raw header, "Cookie:"-prefixed,
 * JSON object/array, Set-Cookie lines, base64. Normalization happens both
 * client-side (preview) and server-side (source of truth).
 * Supports MULTIPLE accounts: each paste creates its own connection + sidecar.
 * Edit mode (connection) replaces that account's cookie.
 */

// Client-side mirror of the server normalizer (subset — server re-normalizes).
function normalizeClient(input) {
  if (!input || typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;
  if (/^[A-Za-z0-9+/=\s]{40,}$/.test(s) && !s.includes("__Secure-")) {
    try {
      const bin = atob(s.replace(/\s+/g, ""));
      if (bin.includes("__Secure-1PSID")) s = bin;
    } catch {}
  }
  // JSON string forms: {"__Secure-1PSID": "..."} or [{"name":..,"value":..}] or {"cookie":"..."}
  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) s = j.map((x) => (typeof x === "string" ? x : `${x.name ?? x.Name}=${x.value ?? x.Value}`)).join("; ");
    else if (j && typeof j === "object") s = typeof j.cookie === "string" ? j.cookie : Object.entries(j).map(([k, v]) => `${k}=${v}`).join("; ");
  } catch {}
  s = s.replace(/^\s*cookie\s*:\s*/i, "");
  const first = s.search(/__Secure-1PSID/i);
  if (first > 0) s = s.slice(first);
  const jar = new Map();
  const re = /([A-Za-z0-9_$\-]+)=([^;\n\r]*?)(?=(?:;|\n|\r|$))/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const name = m[1].trim();
    if (!name || name.toLowerCase() === "cookie") continue;
    jar.set(name, m[2].trim());
  }
  const canonical = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  return canonical.includes("__Secure-1PSID=") && canonical.includes("__Secure-1PSIDTS=") ? canonical : null;
}

export default function GeminiWebCookieModal({ isOpen, onSuccess, onClose, connection = null }) {
  const [cookie, setCookie] = useState("");
  const [name, setName] = useState(connection?.name || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const editing = !!connection?.id;
  const normalized = cookie.trim() ? normalizeClient(cookie) : null;
  const looksValid = editing || !!normalized;

  const handleSubmit = async () => {
    if (!cookie.trim() && !editing) {
      setError("Paste your cookie first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/oauth/geminiweb/cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie: cookie.trim() || undefined,
          name: name.trim() || undefined,
          connectionId: editing ? connection.id : undefined,
        }),
      });
      // Guard: the API must answer JSON. If something in front of it (proxy,
      // auth redirect, error page) answers HTML, explain that instead of
      // crashing with "Unexpected token '<'".
      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text();
      let data;
      if (contentType.includes("application/json")) {
        data = JSON.parse(raw);
      } else {
        throw new Error(
          `Server menjawab halaman (HTTP ${res.status}) alih-alih JSON — biasanya sesi login dashboard habis. ` +
          "Refresh halaman, login ulang, lalu coba lagi."
        );
      }
      if (!res.ok) throw new Error(data.error || "Authentication failed");
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.(data);
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCookie("");
    setName(connection?.name || "");
    setError(null);
    setSuccess(false);
    onClose?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={editing ? "Edit Gemini Web Account" : "Add Gemini Web Account"}>
      <div className="space-y-4">
        {success ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-lg font-medium text-text-primary">{editing ? "Account Updated!" : "Account Connected!"}</p>
            <p className="text-sm text-text-muted mt-2">Sidecar healthy — chat verified</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm text-text-muted">
                Paste the browser cookie from{" "}
                <a
                  href="https://gemini.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  gemini.google.com
                </a>
                {editing ? " to update this account" : ". Each account gets its own connection and sidecar — requests round-robin between them."}
              </p>
              <div className="bg-surface-secondary p-3 rounded-lg text-xs space-y-2">
                <p className="font-medium text-text-primary">Format apa pun diterima — otomatis dinormalisasi:</p>
                <ul className="list-disc list-inside space-y-1 text-text-muted">
                  <li>Header <code>Cookie</code> mentah dari DevTools (boleh dengan prefix <code>Cookie:</code>)</li>
                  <li>JSON object/array cookie, dump request headers</li>
                  <li>Base64, atau hasil copy yang mengandung newline/rusak</li>
                </ul>
                <p className="text-text-muted">Wajib ada <code>__Secure-1PSID</code> dan <code>__Secure-1PSIDTS</code>.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">Account Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Akun 1 — gmailku@gmail.com"
                className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">
                Cookie {editing && <span className="text-text-muted font-normal">(leave empty to keep current)</span>}
              </label>
              <textarea
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="Paste dalam format apa pun — raw header, Cookie: ..., JSON, base64"
                className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={6}
                disabled={loading}
              />
              {cookie.trim() && !editing && (
                <p className={`text-xs ${normalized ? "text-green-500" : "text-amber-500"}`}>
                  {normalized
                    ? `✓ Cookie terdeteksi & dinormalisasi (${normalized.split("; ").length} field)`
                    : "Belum terlihat __Secure-1PSID + __Secure-1PSIDTS — cek lagi paste-mu (server tetap akan mencoba)"}
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={handleClose} disabled={loading} fullWidth>
                Cancel
              </Button>
              <Button onClick={handleSubmit} loading={loading} fullWidth>
                {editing ? "Update Account" : "Add Account"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

GeminiWebCookieModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func,
  connection: PropTypes.object,
};
