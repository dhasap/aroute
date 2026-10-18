"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Modal, Button } from "@/shared/components";

/**
 * Gemini Web Cookie Authentication Modal
 * Supports MULTIPLE accounts: each paste creates its own connection + sidecar
 * instance (own port). Edit mode (connectionId) replaces that account's cookie.
 */
export default function GeminiWebCookieModal({ isOpen, onSuccess, onClose, connection = null }) {
  const [cookie, setCookie] = useState("");
  const [name, setName] = useState(connection?.name || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const editing = !!connection?.id;

  const handleSubmit = async () => {
    if (!cookie.trim() && !editing) {
      setError("Please paste your cookie");
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
      const data = await res.json();
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
                <p className="font-medium text-text-primary">How to get cookie:</p>
                <ol className="list-decimal list-inside space-y-1 text-text-muted">
                  <li>Open gemini.google.com and sign in (use a different Google account for each connection)</li>
                  <li>Press F12 → Network tab, reload the page</li>
                  <li>Find a request to <code>batchexecute?rpcids=otAQ7b</code></li>
                  <li>Copy its complete <code>Cookie</code> request header</li>
                  <li>Paste it below</li>
                </ol>
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
                Cookie String {editing && <span className="text-text-muted font-normal">(leave empty to keep current)</span>}
              </label>
              <textarea
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="__Secure-1PSID=...; __Secure-1PSIDTS=...; ..."
                className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={5}
                disabled={loading}
              />
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
