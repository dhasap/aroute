"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button } from "@/shared/components";
import { CONSOLE_LOG_CONFIG } from "@/shared/constants/config";

const ENDPOINT = "/api/translator/console-logs";
const STREAM = `${ENDPOINT}/stream`;

const LOG_LEVEL_COLORS = {
  LOG: "text-green-400",
  INFO: "text-blue-400",
  WARN: "text-yellow-400",
  ERROR: "text-red-400",
  DEBUG: "text-purple-400",
};

function colorLine(line) {
  const match = line.match(/\[(\w+)\]/g);
  const levelTag = match ? match[1]?.replace(/\[|\]/g, "") : null;
  const color = LOG_LEVEL_COLORS[levelTag] || "text-green-400";
  return <span className={color}>{line}</span>;
}

// The buffer only ever grows by append and only shrinks by eviction or clear,
// so first + last + length is enough to tell "nothing changed" apart from
// "server moved on" without diffing every line on every tick.
function sameLines(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  return a[0] === b[0] && a[a.length - 1] === b[b.length - 1];
}

export default function ConsoleLogClient() {
  const [logs, setLogs] = useState([]);
  const [live, setLive] = useState(false);
  const logRef = useRef(null);

  const handleClear = async () => {
    setLogs([]);
    try {
      await fetch(ENDPOINT, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to clear console logs:", err);
    }
  };

  // Server-sent events: instant lines while they actually arrive.
  useEffect(() => {
    const es = new EventSource(STREAM);

    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "init") {
        const next = msg.logs.slice(-CONSOLE_LOG_CONFIG.maxLines);
        setLogs((prev) => (sameLines(prev, next) ? prev : next));
      } else if (msg.type === "line") {
        setLogs((prev) => {
          const next = [...prev, msg.line];
          return next.length > CONSOLE_LOG_CONFIG.maxLines ? next.slice(-CONSOLE_LOG_CONFIG.maxLines) : next;
        });
      } else if (msg.type === "lines") {
        setLogs((prev) => {
          const next = [...prev, ...msg.lines];
          return next.length > CONSOLE_LOG_CONFIG.maxLines ? next.slice(-CONSOLE_LOG_CONFIG.maxLines) : next;
        });
      } else if (msg.type === "clear") {
        setLogs([]);
      }
    };

    return () => es.close();
  }, []);

  // Snapshot polling — the source of truth. The stream cannot be the only
  // path: anything that buffers the response (cloudflared does, so every
  // SSE endpoint on this app returns 200 with an empty body through the
  // tunnel) leaves the page showing nothing while the buffer is full.
  // Polling keeps the page correct regardless, and the stream just makes
  // lines land faster than the next tick.
  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const res = await fetch(ENDPOINT, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive || !Array.isArray(data.logs)) return;
        const next = data.logs.slice(-CONSOLE_LOG_CONFIG.maxLines);
        setLogs((prev) => (sameLines(prev, next) ? prev : next));
      } catch {
        // Transient failure between ticks; keep the last lines we had.
      }
    };

    tick();
    const id = setInterval(tick, CONSOLE_LOG_CONFIG.pollIntervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="">
      <Card>
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-xs text-text-muted">
            {logs.length > 0 ? `${logs.length} baris` : ""}
            {live ? " · live" : " · polling"}
          </span>
          <Button size="sm" variant="outline" icon="delete" onClick={handleClear}>
            Clear
          </Button>
        </div>
        <div
          ref={logRef}
          className="bg-black rounded-b-lg p-4 text-xs font-mono h-[calc(100vh-220px)] overflow-y-auto"
        >
          {logs.length === 0 ? (
            <span className="text-text-muted">No console logs yet.</span>
          ) : (
            <div className="space-y-0.5">
              {logs.map((line, i) => (
                <div key={i}>{colorLine(line)}</div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
