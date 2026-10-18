// Gemini Web (gemini-web-to-api sidecar, localhost:4981) — reverse-engineered
// Gemini Web bridge (github.com/ntthanh2603/gemini-web-to-api, Go binary at
// ~/gemini-web/). OpenAI-compatible endpoints; auth = Google cookies pasted in
// the dashboard "Add Cookie" modal (written to the sidecar .env). Thinking
// level rides reasoning_effort (low/medium/high) mapped by the sidecar to
// Gemini thinking levels. Model ids are friendly aliases resolved to the
// account's registry (GEMINI_MODEL_ALIASES). Verified live 2026-10-19.
export default {
  id: "geminiweb",
  priority: 55,
  hasFree: true,
  alias: "geminiweb",
  aliases: ["gemini-web", "gemini-web-to-api", "gwta"],
  uiAlias: "geminiweb",
  display: {
    name: "Gemini Web",
    icon: "sparkle",
    color: "#4285F4",
    textIcon: "GW",
    website: "https://gemini.google.com",
    notice: {
      text: "Routes through Gemini Web (gemini.google.com) with your Google account. 4 models — Gemini 4 Argon, 3.8 Flash, 3.1 Pro, 3.5 Flash Lite — each with low/medium/high thinking levels, plus tool-call support. Connect by pasting your browser cookies via the Cookie button; sessions may need a fresh paste when Google rotates them.",
      apiKeyUrl: "https://gemini.google.com",
    },
    authHint: "Paste the full Cookie header from gemini.google.com (F12 → Network → batchexecute request). Must contain __Secure-1PSID and __Secure-1PSIDTS.",
  },
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "http://127.0.0.1:20128/geminiweb/4981/openai/v1/chat/completions",
    validateUrl: "http://127.0.0.1:4981/openai/v1/models",
    thinkingFormat: "openai",
  },
  models: [
    { id: "gemini-4-argon", isFree: true, name: "Gemini 4 Argon (Web)", vision: true, reasoning: true },
    { id: "gemini-3.8-flash", isFree: true, name: "Gemini 3.8 Flash (Web)", vision: true, reasoning: true },
    { id: "gemini-3.1-pro", isFree: true, name: "Gemini 3.1 Pro (Web)", vision: true, reasoning: true },
    { id: "gemini-3.5-flash-lite", isFree: true, name: "Gemini 3.5 Flash Lite (Web)", vision: true, reasoning: true },
  ],
  passthroughModels: false,
};
