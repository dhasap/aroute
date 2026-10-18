import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { createProviderConnection, getProviderConnections, updateProviderConnection } from "@/models";
import { getSettings, updateSettings } from "@/lib/localDb";

const run = promisify(execFile);

const GEMINI_WEB_BASE_PORT = Number(process.env.GEMINI_WEB_PORT || 4981);
const CONTROL_PORT = GEMINI_WEB_BASE_PORT + 10000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function validCookieShape(c) {
  return c.includes("__Secure-1PSID=") && c.includes("__Secure-1PSIDTS=");
}

async function healthOk(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return data.status === "ok";
  } catch { return false; }
}

async function spawnSidecar(port, cookie) {
  try {
    await fetch(`http://127.0.0.1:${CONTROL_PORT}/__geminiweb/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ port, cookie }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // control endpoint unavailable (old custom-server / non-managed): legacy path
    try {
      await run("pkill", ["-f", "gemini-web/gemini-web-to-api"]);
      await sleep(4000);
      if (!(await healthOk(GEMINI_WEB_BASE_PORT))) {
        await run("bash", ["-lc", "cd " + path.join(os.homedir(), "gemini-web") + " && nohup ./gemini-web-to-api > /tmp/gwta.log 2>&1 & sleep 1"], { timeout: 15000 });
      }
    } catch {}
  }
}

async function chatOk(port) {
  try {
    const chat = await fetch(`http://127.0.0.1:${port}/openai/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-auto", messages: [{ role: "user", content: "Reply with exactly: ok" }] }),
      signal: AbortSignal.timeout(45000),
    });
    const data = await chat.json();
    return !!data.choices;
  } catch { return false; }
}

/**
 * POST /api/oauth/geminiweb/cookie
 * Body: { cookie, name?, connectionId? }
 *  - connectionId present → replace that account's cookie (same sidecar port).
 *  - otherwise → create a NEW account: first uses legacy port 4981 (.env),
 *    additional accounts get ports 4982+ spawned with per-process GEMINI_COOKIES.
 * Both paths verify health + a chat round-trip before returning.
 */
export async function POST(request) {
  try {
    const { cookie, name, connectionId } = await request.json();
    if (!cookie || typeof cookie !== "string") {
      return NextResponse.json({ error: "Cookie is required" }, { status: 400 });
    }
    const trimmed = cookie.trim();
    if (!validCookieShape(trimmed)) {
      return NextResponse.json(
        { error: "Cookie must contain __Secure-1PSID and __Secure-1PSIDTS (copy the full Cookie header from gemini.google.com)" },
        { status: 400 }
      );
    }

    // Legacy .env write for port 4981 (backward compatible with old sidecar boot)
    const envPaths = [
      path.join(process.cwd(), "vendor", "gemini-web", ".env"),
      path.join(process.cwd(), "..", "vendor", "gemini-web", ".env"),
      path.join(os.homedir(), "gemini-web", ".env"),
    ];
    const seen = new Set();
    for (const envPath of envPaths) {
      if (seen.has(envPath)) continue;
      seen.add(envPath);
      let env = "";
      try { env = fs.readFileSync(envPath, "utf8"); } catch { env = "APP_ENV=production\nPORT=4981\n"; }
      const cookieLine = `GEMINI_COOKIES=${trimmed}`;
      if (/^GEMINI_COOKIES=/m.test(env)) env = env.replace(/^GEMINI_COOKIES=.*$/m, cookieLine);
      else env = env.trimEnd() + "\n" + cookieLine + "\n";
      try { fs.writeFileSync(envPath, env); } catch {}
    }

    const connections = await getProviderConnections({ provider: "geminiweb" });

    let conn;
    let port;
    if (connectionId) {
      conn = connections.find((c) => c.id === connectionId);
      if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
      port = conn.providerSpecificData?.sidecarPort || GEMINI_WEB_BASE_PORT;
    } else {
      // New account: reuse the legacy port only if it has no connection yet.
      const usedPorts = new Set(connections.map((c) => c.providerSpecificData?.sidecarPort || GEMINI_WEB_BASE_PORT));
      if (connections.length === 0) {
        port = GEMINI_WEB_BASE_PORT;
      } else {
        port = GEMINI_WEB_BASE_PORT + 1;
        while (usedPorts.has(port)) port += 1;
      }
      const psd = {
        connectionProxyEnabled: false,
        connectionProxyUrl: "",
        connectionNoProxy: "",
        sidecarPort: port,
        baseUrl: `http://127.0.0.1:${process.env.PORT || 20128}/geminiweb/${port}/openai/v1/chat/completions`,
      };
      const created = await createProviderConnection({
        provider: "geminiweb",
        authType: "apikey",
        name: (name && name.trim()) || `Gemini Web #${connections.length + 1}`,
        email: null,
        priority: connections.length,
        isActive: true,
        apiKey: "local-sidecar",
        testStatus: "active",
        providerSpecificData: psd,
      });
      conn = { ...created, providerSpecificData: psd };
      connections.push(conn);
    }

    // Spawn/replace that account's sidecar, wait health, verify chat.
    await spawnSidecar(port, trimmed);
    let healthy = false;
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      if (await healthOk(port)) { healthy = true; break; }
    }
    if (!healthy) {
      return NextResponse.json({ error: `Sidecar on port ${port} did not become healthy — cookies may be expired or invalid. Check /tmp/aroute.log` }, { status: 502 });
    }
    if (!(await chatOk(port))) {
      return NextResponse.json({ error: "Cookie accepted by sidecar but chat failed" }, { status: 502 });
    }

    await updateProviderConnection(conn.id, {
      testStatus: "active",
      lastError: null,
      providerSpecificData: {
        ...(conn.providerSpecificData || {}),
        sidecarPort: port,
        baseUrl: `http://127.0.0.1:${process.env.PORT || 20128}/geminiweb/${port}/openai/v1/chat/completions`,
      },
    });

    const total = connections.length;
    // Auto-enable round-robin once multiple accounts exist (sticky limit 1 = strict rotation)
    if (total > 1) {
      try {
        const settingsData = await getSettings();
        const strategies = { ...(settingsData.providerStrategies || {}) };
        const cur = strategies.geminiweb || {};
        if (cur.fallbackStrategy !== "round-robin") {
          strategies.geminiweb = { ...cur, fallbackStrategy: "round-robin", stickyRoundRobinLimit: cur.stickyRoundRobinLimit || 1 };
          await updateSettings({ providerStrategies: strategies });
        }
      } catch {}
    }
    return NextResponse.json({
      success: true,
      connectionId: conn.id,
      port,
      accounts: total,
      message: connectionId
        ? `Account updated — sidecar healthy on :${port}, chat verified`
        : `Account "${conn.name}" connected on :${port} — ${total} account${total > 1 ? "s" : ""} total, chat verified`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 });
  }
}
