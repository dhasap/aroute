"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card } from "@/shared/components";

const STORAGE_KEY = "playground.session.v1";
const MAX_MESSAGES = 200;

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Playground — direct model chat inside the dashboard.
 * Streams SSE from /api/playground/chat (dashboard-cookie authenticated proxy
 * into the /v1 chat engine, so combos, aliases and RTK all apply).
 */
export default function PlaygroundClient() {
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(1);
  const [maxTokens, setMaxTokens] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // ---- load model list ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/playground/models", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load models (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const list = (data.data || [])
          .filter((m) => m && m.id)
          .map((m) => ({ id: m.id, name: m.name || m.id, kind: m.kind || m.type || "llm" }))
          .sort((a, b) => a.id.localeCompare(b.id));
        setModels(list);
        setModelsError("");
      } catch (e) {
        if (!cancelled) setModelsError(e?.message || "Failed to load models");
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- persisted session ----
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && Array.isArray(saved.messages)) {
        setMessages(saved.messages.slice(-MAX_MESSAGES));
        setSystemPrompt(saved.systemPrompt || "");
        setTemperature(typeof saved.temperature === "number" ? saved.temperature : 1);
        setMaxTokens(saved.maxTokens || "");
        if (saved.selectedModel) setSelectedModel(saved.selectedModel);
      }
    } catch { /* fresh start */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        messages: messages.slice(-MAX_MESSAGES),
        selectedModel,
        systemPrompt,
        temperature,
        maxTokens,
      }));
    } catch { /* quota — ignore */ }
  }, [messages, selectedModel, systemPrompt, temperature, maxTokens]);

  // auto-select first model when none picked
  useEffect(() => {
    if (!selectedModel && models.length) setSelectedModel(models[0].id);
  }, [models, selectedModel]);

  // autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const modelGroups = useMemo(() => {
    const groups = new Map();
    for (const m of models) {
      const prefix = m.id.includes("/") ? m.id.split("/")[0] : "combo";
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix).push(m);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [models]);

  // Two-step selection: provider first, then that provider's models only.
  // All sync is EVENT-DRIVEN (handlers), never effects — effects watching both
  // values created a state ping-pong that reverted the user's selection.
  const [selectedProvider, setSelectedProvider] = useState("");

  const availableProviders = useMemo(() => modelGroups.map(([g]) => g), [modelGroups]);

  // Initial sync ONLY: when the model list arrives (or restores from storage),
  // pin the provider to the persisted model's owner, or default to the first.
  const initialSyncDone = useRef(false);
  useEffect(() => {
    if (initialSyncDone.current || !availableProviders.length) return;
    initialSyncDone.current = true;
    const owner = selectedModel
      ? (selectedModel.includes("/") ? selectedModel.split("/")[0] : "combo")
      : "";
    setSelectedProvider(availableProviders.includes(owner) ? owner : availableProviders[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableProviders]);

  // Explicit provider change: switch model to that provider's first one.
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const controlsRef = useRef(null);
  // Menu panel renders position:fixed (escapes the Card's overflow:hidden clip,
  // which was preventing the scrollable dropdown). Position is computed in a
  // layout effect right after open — never from a stale click-time rect.
  const providerTriggerRef = useRef(null);
  const modelTriggerRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ left: 0, width: 200, top: 0 });
  useLayoutEffect(() => {
    const el = providerMenuOpen ? providerTriggerRef.current : modelMenuOpen ? modelTriggerRef.current : null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ left: r.left, width: r.width, top: r.bottom + 4 });
  }, [providerMenuOpen, modelMenuOpen]);
  useEffect(() => {
    const onDoc = (e) => {
      // Ignore clicks inside the portal-rendered menu panels — otherwise the
      // mousedown closes/unmounts the panel before the item's click fires.
      if (e.target.closest?.("[data-menu-panel]")) return;
      if (controlsRef.current && !controlsRef.current.contains(e.target)) {
        setProviderMenuOpen(false);
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleProviderChange = (provider) => {
    setSelectedProvider(provider);
    const items = modelGroups.find(([g]) => g === provider)?.[1] || [];
    if (items.length && !items.some((m) => m.id === selectedModel)) {
      setSelectedModel(items[0].id);
    }
  };

  const providerModels = useMemo(
    () => modelGroups.find(([g]) => g === selectedProvider)?.[1] || [],
    [modelGroups, selectedProvider]
  );

  // Guard the persisted model against a provider that vanished since last visit.
  useEffect(() => {
    if (!initialSyncDone.current || !selectedProvider) return;
    const items = modelGroups.find(([g]) => g === selectedProvider)?.[1] || [];
    if (items.length && !items.some((m) => m.id === selectedModel) && selectedModel) {
      setSelectedModel(items[0].id);
    }
    // only re-check when the provider's model list itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerModels]);

  const updateLast = (text) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant") {
          next[i] = { ...next[i], content: text };
          break;
        }
      }
      return next;
    });
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!selectedModel) { setError("Pick a model first"); return; }

    setError("");
    const userMsg = { id: createId(), role: "user", content: text, at: Date.now() };
    const assistantMsg = { id: createId(), role: "assistant", content: "", at: Date.now() };
    const history = [...messages, userMsg];

    const payloadMessages = [];
    if (systemPrompt.trim()) {
      payloadMessages.push({ role: "system", content: systemPrompt.trim() });
    }
    for (const m of history) {
      payloadMessages.push({ role: m.role, content: m.content });
    }

    const body = {
      model: selectedModel,
      messages: payloadMessages,
      stream: true,
    };
    const maxTok = parseInt(maxTokens, 10);
    if (Number.isFinite(maxTok) && maxTok > 0) body.max_tokens = maxTok;
    if (typeof temperature === "number" && temperature !== 1) body.temperature = temperature;

    setMessages([...history, assistantMsg]);
    setInput("");
    setBusy(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/playground/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Request failed (${res.status})`);
      }

      if (!res.body) {
        const data = await res.json().catch(() => ({}));
        const text = data?.choices?.[0]?.message?.content || "(empty response)";
        updateLast(text);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload);
            const delta = chunk?.choices?.[0]?.delta || {};
            if (typeof delta.content === "string") acc += delta.content;
            if (typeof delta.reasoning_content === "string") {
              // surface reasoning separately? keep it out of the visible answer
            }
            if (chunk?.error) {
              throw new Error(chunk.error.message || JSON.stringify(chunk.error));
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue; // partial JSON — wait for more
            throw e;
          }
        }
        // update UI as we go
        if (acc) updateLast(acc);
      }

      updateLast(acc || "(empty response)");
    } catch (e) {
      if (e?.name === "AbortError") {
        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === "assistant" && !next[i].content) {
              next[i] = { ...next[i], content: "(stopped)" };
              break;
            }
          }
          return next;
        });
      } else {
        setError(e?.message || "Request failed");
        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === "assistant" && !next[i].content) {
              next[i] = { ...next[i], content: `⚠ ${e?.message || "Request failed"}`, isError: true };
              break;
            }
          }
          return next;
        });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearSession = () => {
    stop();
    setMessages([]);
    setError("");
  };

  const selectedLabel = models.find((m) => m.id === selectedModel)?.id || "—";

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-140px)] min-h-[520px]">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Playground</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Chat directly with any model or combo routed through ARoute — combos, aliases and token-saver all apply.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={clearSession} icon="delete">
            Clear
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="p-3">
        <div ref={controlsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <label className="text-xs font-medium mb-1 block">Provider</label>
            <button
              ref={providerTriggerRef}
              type="button"
              onClick={() => { if (!modelsLoading && availableProviders.length) { setProviderMenuOpen((v) => !v); setModelMenuOpen(false); } }}
              disabled={modelsLoading || availableProviders.length === 0}
              className="w-full px-2 py-2 bg-surface rounded border border-border text-xs text-left flex items-center justify-between gap-2 focus:outline-none focus:border-primary/60 disabled:opacity-50"
            >
              <span className="truncate">{modelsLoading ? "Loading…" : (selectedProvider || "No providers")}</span>
              <span className="text-muted-foreground text-[10px]">▼</span>
            </button>
            {providerMenuOpen && createPortal(
              <div
                style={{ position: "fixed", top: menuPos.top, left: menuPos.left, width: menuPos.width }}
                data-menu-panel=""
                className="z-50 max-h-64 overflow-y-auto bg-surface border border-border rounded shadow-lg py-1"
              >
                {availableProviders.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { handleProviderChange(g); setProviderMenuOpen(false); }}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-primary/10 ${g === selectedProvider ? "bg-primary/15 font-medium" : ""}`}
                  >
                    {g}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
          <div className="relative lg:col-span-2">
            <label className="text-xs font-medium mb-1 block">Model</label>
            <button
              ref={modelTriggerRef}
              type="button"
              onClick={() => { if (!modelsLoading && providerModels.length) { setModelMenuOpen((v) => !v); setProviderMenuOpen(false); } }}
              disabled={modelsLoading || providerModels.length === 0}
              className="w-full px-2 py-2 bg-surface rounded border border-border text-xs text-left flex items-center justify-between gap-2 focus:outline-none focus:border-primary/60 disabled:opacity-50"
            >
              <span className="truncate">{modelsLoading ? "Loading models…" : (providerModels.length ? selectedModel : "No models for this provider")}</span>
              <span className="text-muted-foreground text-[10px]">▼</span>
            </button>
            {modelMenuOpen && createPortal(
              <div
                style={{ position: "fixed", top: menuPos.top, left: menuPos.left, width: menuPos.width }}
                data-menu-panel=""
                className="z-50 max-h-64 overflow-y-auto bg-surface border border-border rounded shadow-lg py-1"
              >
                {providerModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-primary/10 ${m.id === selectedModel ? "bg-primary/15 font-medium" : ""}`}
                  >
                    {m.id}
                  </button>
                ))}
              </div>,
              document.body
            )}
            {modelsError && <p className="text-[10px] text-red-500 mt-1">{modelsError}</p>}
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Temperature: {temperature}</label>
            <input
              type="range" min="0" max="2" step="0.1" value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Max tokens</label>
            <input
              type="number" min="1" value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="provider default"
              className="w-full px-2 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:border-primary/60"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs font-medium mb-1 block">System prompt (per-request)</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={2}
            placeholder="Optional — prepended as a system message before the conversation."
            className="w-full px-3 py-2 bg-surface rounded border border-border text-xs font-mono focus:outline-none focus:border-primary/60 resize-y"
          />
        </div>
      </Card>

      {/* Transcript */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div className="text-text-muted">
                <span className="material-symbols-outlined text-3xl mb-2 block">forum</span>
                <p className="text-sm">Send a message to test <span className="font-mono">{selectedLabel}</span></p>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                m.role === "user"
                  ? "self-end bg-primary text-white"
                  : m.isError
                    ? "self-start bg-red-500/10 text-red-500 border border-red-500/30"
                    : "self-start bg-surface border border-border"
              }`}
            >
              {m.content}
            </div>
          ))}
          {busy && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
            <div className="self-start text-text-muted text-xs animate-pulse">thinking…</div>
          )}
        </div>

        {error && (
          <div className="px-4 pb-2 text-xs text-red-500">{error}</div>
        )}

        {/* Composer */}
        <div className="p-3 border-t border-border flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={`Message ${selectedLabel}… (Enter to send, Shift+Enter for newline)`}
            className="flex-1 px-3 py-2 bg-surface rounded border border-border text-sm focus:outline-none focus:border-primary/60 resize-none"
            disabled={busy}
          />
          {busy ? (
            <Button variant="ghost" size="sm" onClick={stop} icon="stop">Stop</Button>
          ) : (
            <Button size="sm" onClick={send} disabled={!input.trim()} icon="send">Send</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
