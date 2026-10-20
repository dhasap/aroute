require("./scripts/legacy-env-compat.cjs");

const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { pathToFileURL } = require("url");

const origCreate = http.createServer.bind(http);

// Per-process secret proving x-9r-real-ip was stamped below rather than sent by the client.
// A bare `next start` / `next dev` never loads this file, so it cannot produce a matching
// header even though the env var is inherited by child processes. Named like x-9r-cli-token
// so the request-detail header sanitizer redacts it too.
const PEER_TOKEN = crypto.randomBytes(24).toString("hex");
process.env.AROUTE_PEER_TOKEN = PEER_TOKEN;

let backgroundRefreshStarted = false;

function startBackgroundTokenRefreshFromCustomServer() {
  if (backgroundRefreshStarted) return;
  backgroundRefreshStarted = true;
  // Prefer source path (repo / standalone that still has src). Fail-open if missing
  // — initializeApp also starts the same scheduler when the Next app boots.
  const modPath = path.join(__dirname, "src", "sse", "services", "backgroundTokenRefresh.js");
  import(pathToFileURL(modPath).href)
    .then((m) => {
      try {
        m.startBackgroundTokenRefresh();
      } catch (e) {
        console.error("[BackgroundTokenRefresh] start failed:", e && e.message ? e.message : e);
      }
      const stop = () => {
        try {
          m.stopBackgroundTokenRefresh();
        } catch {
          /* ignore */
        }
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    })
    .catch((e) => {
      // Expected in published CLI standalone (src/ not on disk). App bootstrap covers it.
      if (process.env.DEBUG_BACKGROUND_TOKEN_REFRESH) {
        console.error("[BackgroundTokenRefresh] import failed:", e && e.message ? e.message : e);
      }
    });
}

// Wrap Next standalone HTTP server: derive client IP from the TCP socket
// (unspoofable) and strip client-supplied forwarding headers so downstream
// rate-limiting keys on the real peer address instead of attacker-controlled XFF.
http.createServer = (...args) => {
  const handler = args.find((a) => typeof a === "function");
  const rest = args.filter((a) => typeof a !== "function");
  if (!handler) return origCreate(...args);
  const wrapped = (req, res) => {
    const socketIp = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
    const xff = req.headers["x-forwarded-for"];
    const xRealIp = req.headers["x-real-ip"];
    const viaProxy = !!(xff || xRealIp);
    const isLoopbackProxy = socketIp === "127.0.0.1" || socketIp === "::1" || socketIp === "::ffff:127.0.0.1";
    // Trust forwarding headers only when the TCP peer is a local reverse proxy.
    // Direct/public sockets remain keyed by the unspoofable peer address.
    const proxyIp = xRealIp || (xff ? String(xff).split(",")[0].trim() : "");
    const ip = isLoopbackProxy && proxyIp ? proxyIp : socketIp;
    delete req.headers["x-9r-real-ip"];
    delete req.headers["x-forwarded-for"];
    delete req.headers["x-9r-via-proxy"];
    delete req.headers["x-9r-peer-token"];
    req.headers["x-9r-real-ip"] = ip;
    req.headers["x-9r-peer-token"] = PEER_TOKEN;
    if (viaProxy) req.headers["x-9r-via-proxy"] = "1";
    if (tryGeminiWebRequest(req, res)) return;
    return handler(req, res);
  };
  const server = origCreate(...rest, wrapped);
  server.once("listening", () => {
    startBackgroundTokenRefreshFromCustomServer();
  });
  const origEmit = server.emit;
  // JBR 25 sends h2c upgrades that the HTTP/1.1 server would otherwise close.
  server.emit = function (event, ...eventArgs) {
    const [req, socket, head] = eventArgs;
    if (event !== "upgrade" || String(req.headers.upgrade || "").toLowerCase() !== "h2c") {
      return origEmit.call(this, event, ...eventArgs);
    }

    const contentLength = Number(req.headers["content-length"] || 0);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      socket.destroy();
      return true;
    }
    const chunks = [head];
    let received = head.length;
    const serve = () => {
      // Replay the upgraded request through the existing HTTP/1.1 handler.
      const replay = new http.IncomingMessage(socket);
      Object.assign(replay, { method: req.method, url: req.url, headers: req.headers, complete: true });
      if (received) replay.push(Buffer.concat(chunks, received).subarray(0, contentLength));
      replay.push(null);
      const res = new http.ServerResponse(replay);
      res.shouldKeepAlive = false;
      res.assignSocket(socket);
      res.once("finish", () => socket.end());
      Promise.resolve().then(() => wrapped(replay, res)).catch((error) => {
        console.error("Failed to downgrade h2c request", error);
        socket.destroy();
      });
    };
    if (received >= contentLength) serve();
    else {
      socket.on("data", function readBody(chunk) {
        chunks.push(chunk);
        received += chunk.length;
        if (received < contentLength) return;
        socket.off("data", readBody);
        serve();
      });
      socket.resume();
    }
    delete req.headers.upgrade;
    delete req.headers["http2-settings"];
    req.headers.connection = "close";
    return true;
  };
  return server;
};

// ── Gemini Web sidecar (vendored gemini-web-to-api) ───────────────────────────
// Managed child processes so ARoute is a single deploy. Multi-account: one
// sidecar per connection, each on its own port (4981, 4982, ...), with the
// account's cookie injected via GEMINI_COOKIES env (DB is the source of truth —
// synced by the cookie API route). Port 4981 also falls back to the .env file
// for backward compatibility.
const { spawn } = require("child_process");

const GEMINI_WEB_PORT = process.env.GEMINI_WEB_PORT || "4981";
const geminiWebChildren = new Map(); // port -> { child, retries, cookie }
let geminiWebShuttingDown = false;

function geminiWebBinary() {
  const candidates = [
    path.join(__dirname, "vendor", "gemini-web", "gemini-web-to-api"),
    path.join(__dirname, "..", "vendor", "gemini-web", "gemini-web-to-api"),
    path.join(process.env.HOME || "", "gemini-web", "gemini-web-to-api"),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function startGeminiWebSidecar(port = GEMINI_WEB_PORT, cookie = null) {
  const bin = geminiWebBinary();
  if (!bin) {
    console.error("[GeminiWeb] sidecar binary not found — provider disabled");
    return;
  }
  port = String(port);
  const prev = geminiWebChildren.get(port);
  if (prev) {
    try { prev.child.kill("SIGKILL"); } catch {}
    geminiWebChildren.delete(port);
  }
  const env = { ...process.env, PORT: port, HOST: "127.0.0.1" };
  // Egress for the sidecar: on hosts where Google is only reachable via a proxy
  // (fake-IP egress VMs), GEMINI_WEB_PROXY supplies it — direct dials would fail.
  if (process.env.GEMINI_WEB_PROXY) {
    env.HTTPS_PROXY = env.HTTPS_PROXY || process.env.GEMINI_WEB_PROXY;
    env.https_proxy = env.https_proxy || process.env.GEMINI_WEB_PROXY;
  }
  if (cookie) env.GEMINI_COOKIES = cookie;
  const child = spawn(bin, [], {
    cwd: path.dirname(bin),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tag = `[GeminiWeb:${port}]`;
  const entry = { child, retries: 0, cookie };
  geminiWebChildren.set(port, entry);
  child.stdout.on("data", (d) => process.stdout.write(`${tag} ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`${tag} ${d}`));
  child.once("exit", (code, signal) => {
    const cur = geminiWebChildren.get(port);
    if (!cur || cur.child !== child) return; // replaced — ignore
    geminiWebChildren.delete(port);
    if (geminiWebShuttingDown) return;
    cur.retries += 1;
    const delay = Math.min(30000, 2000 * cur.retries);
    console.error(`${tag} exited (code=${code} signal=${signal}) — restart in ${delay}ms`);
    setTimeout(() => startGeminiWebSidecar(port, cur.cookie), delay);
  });
  console.log(`${tag} sidecar starting${cookie ? " (account cookie)" : ""} (pid ${child.pid})`);
}


// ── Unified Gemini Web proxy ──────────────────────────────────────────────────
// All Gemini Web traffic flows through the main ARoute port under /geminiweb/<port>/...
// Sidecars themselves bind loopback only (HOST=127.0.0.1) — never exposed directly.
function tryGeminiWebRequest(req, res) {
  const m = String(req.url || "").match(/^\/geminiweb\/(\d+)(\/.*)$/);
  if (!m) return false;
  const targetPort = m[1];
  const innerPath = m[2];
  const fwdHeaders = { ...req.headers };
  delete fwdHeaders.host;
  delete fwdHeaders.connection;
  const preq = http.request(
    { host: "127.0.0.1", port: targetPort, path: innerPath, method: req.method, headers: fwdHeaders },
    (pres) => {
      res.writeHead(pres.statusCode, pres.headers);
      pres.pipe(res);
    }
  );
  preq.on("error", (e) => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `Gemini Web sidecar on port ${targetPort} unavailable: ${e.message}` } }));
  });
  req.pipe(preq);
  return true;
}

function stopGeminiWebSidecar() {
  geminiWebShuttingDown = true;
  for (const [, entry] of geminiWebChildren) {
    try { entry.child.kill("SIGTERM"); } catch {}
  }
}

// Local control endpoint: lets API routes start/replace per-account sidecars.
// POST http://127.0.0.1:<port+10000>/__geminiweb/start  body: {port, cookie}
const GEMINI_WEB_CONTROL_PORT = Number(GEMINI_WEB_PORT) + 10000;
function startGeminiWebControl() {
  const srv = http.createServer((req, res) => {
    if (req.method !== "POST" || !req.url.startsWith("/__geminiweb/start")) {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", () => {
      try {
        const { port, cookie } = JSON.parse(body || "{}");
        if (!port) { res.writeHead(400).end(JSON.stringify({ error: "port required" })); return; }
        startGeminiWebSidecar(port, cookie || null);
        res.writeHead(200).end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500).end(JSON.stringify({ error: e.message }));
      }
    });
  });
  srv.listen(GEMINI_WEB_CONTROL_PORT, "127.0.0.1");
  console.log(`[GeminiWeb] control endpoint on :${GEMINI_WEB_CONTROL_PORT}`);
}

process.once("SIGINT", () => { stopGeminiWebSidecar(); process.exit(0); });
process.once("SIGTERM", () => { stopGeminiWebSidecar(); process.exit(0); });

if (require.main === module) {
  // Zombie guard: kill orphan sidecars from previous (crashed) boots before binding.
  // Keep our own children (none yet at this point) — pkill by binary name is safe here.
  try { require("child_process").execSync("pkill -9 -f gemini-web/gemini-web-to-api || true"); } catch {}
  // Auto-start the base sidecar only when a default cookie exists in env —
  // otherwise the sidecar exits immediately and we'd loop-restart forever.
  if (process.env.GEMINI_COOKIES) startGeminiWebSidecar();
  startGeminiWebControl();
  const standalone = path.join(__dirname, "server.js");
  if (fs.existsSync(standalone)) {
    require(standalone);
  } else {
    // Repo checkout has no standalone build next to us. `next start` builds its HTTP
    // server in-process, so the wrapper above still sanitizes every request.
    const nextBin = require.resolve("next/dist/bin/next");
    process.argv = [process.argv[0], nextBin, "start", ...process.argv.slice(2)];
    require(nextBin);
  }
}
