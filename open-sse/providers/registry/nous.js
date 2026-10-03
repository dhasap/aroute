// Nous Research (Nous Portal) — inference gateway aggregating 400+ models
// (Anthropic, OpenAI, Google, DeepSeek, Qwen, Kimi, GLM, …). OpenAI-compatible.
// Auth: `Authorization: Bearer <key>` — plain `sk-` API keys minted on the Portal
// (same credential as hermes `NOUS_API_KEY`); the Portal OAuth JWT also works.
export default {
  id: "nous",
  alias: "nous",
  aliases: ["nousresearch", "nous-portal"],
  uiAlias: "nous",
  display: {
    name: "Nous Research",
    icon: "bolt",
    color: "#F97316",
    textIcon: "NR",
    website: "https://nousresearch.com",
    notice: {
      text: "Nous Portal inference API — 400+ models behind one key.",
      apiKeyUrl: "https://portal.nousresearch.com",
    },
  },
  category: "oauth",
  authModes: ["oauth", "apikey"],
  hasOAuth: true,
  transport: {
    baseUrl: "https://inference-api.nousresearch.com/v1/chat/completions",
    validateUrl: "https://inference-api.nousresearch.com/v1/models",
  },
  // Nous Portal device-code login (RFC 8628) — same protocol as `hermes auth add nous`.
  // clientId: the Portal whitelists registered public clients ("aroute" → invalid_client);
  // hermes-cli is the client Nous operates for agent CLIs. Refresh tokens are SINGLE-USE:
  // the token refresh service must persist every rotated refresh_token (see
  // open-sse/services/tokenRefresh REFRESH_PROFILES.nous — refresh rides the
  // x-nous-refresh-token header, never the body).
  oauth: {
    clientId: "hermes-cli",
    deviceCodeUrl: "https://portal.nousresearch.com/api/oauth/device/code",
    tokenUrl: "https://portal.nousresearch.com/api/oauth/token",
    refreshUrl: "https://portal.nousresearch.com/api/oauth/token",
    scope: "inference:invoke",
    // Access tokens live 1h; refresh 2 min before expiry (Portal skew used by hermes).
    refreshLeadMs: 120000,
  },
  // Seed snapshot from hermes' curated Nous catalog. The latest catalogue is
  // fetched via modelsFetcher; other ids (400+ live: :batch, :free, ~aliases)
  // are still accepted via passthroughModels.
  models: [
    { id: "stepfun/step-3.7-flash:free", name: "Step 3.7 Flash (free)" },
    { id: "poolside/laguna-s-2.1:free", name: "Laguna S 2.1 (free)" },
    { id: "poolside/laguna-xs-2.1:free", name: "Laguna XS 2.1 (free)" },
    { id: "anthropic/claude-fable-5.1", name: "Claude Fable 5.1" },
    { id: "anthropic/claude-fable-5", name: "Claude Fable 5" },
    { id: "anthropic/claude-opus-5", name: "Claude Opus 5" },
    { id: "anthropic/claude-opus-4.8", name: "Claude Opus 4.8" },
    { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5" },
    { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5" },
    { id: "openai/gpt-6-astra", name: "Gpt 6 Astra" },
    { id: "openai/gpt-6-astra-fast", name: "Gpt 6 Astra Fast" },
    { id: "openai/gpt-6-astra-flex", name: "Gpt 6 Astra Flex" },
    { id: "openai/gpt-6-astra-pro", name: "Gpt 6 Astra Pro" },
    { id: "openai/gpt-6-astra-pro-fast", name: "Gpt 6 Astra Pro Fast" },
    { id: "openai/gpt-6-astra-pro-flex", name: "Gpt 6 Astra Pro Flex" },
    { id: "openai/gpt-5.6-sol", name: "Gpt 5.6 Sol" },
    { id: "openai/gpt-5.6-sol-pro", name: "Gpt 5.6 Sol Pro" },
    { id: "openai/gpt-5.6-terra", name: "Gpt 5.6 Terra" },
    { id: "openai/gpt-5.6-terra-pro", name: "Gpt 5.6 Terra Pro" },
    { id: "openai/gpt-5.6-luna", name: "Gpt 5.6 Luna" },
    { id: "openai/gpt-5.6-luna-pro", name: "Gpt 5.6 Luna Pro" },
    { id: "openai/gpt-5.5", name: "Gpt 5.5" },
    { id: "openai/gpt-5.5-pro", name: "Gpt 5.5 Pro" },
    { id: "openai/gpt-5.4-mini", name: "Gpt 5.4 Mini" },
    { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
    { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" },
    { id: "google/gemini-3.7-flash", name: "Gemini 3.7 Flash" },
    { id: "x-ai/grok-4.6", name: "Grok 4.6" },
    { id: "deepseek/deepseek-v4-pro", name: "Deepseek V4 Pro" },
    { id: "deepseek/deepseek-v4-pro-0813", name: "Deepseek V4 Pro 0813" },
    { id: "deepseek/deepseek-v4.1-flash", name: "Deepseek V4.1 Flash" },
    { id: "deepseek/deepseek-v4-flash-0731", name: "Deepseek V4 Flash 0731" },
    { id: "qwen/qwen3.8-max-0902", name: "Qwen3.8 Max 0902" },
    { id: "qwen/qwen3.8-flash", name: "Qwen3.8 Flash" },
    { id: "moonshotai/kimi-k3", name: "Kimi K3" },
    { id: "minimax/minimax-m3", name: "Minimax M3" },
    { id: "z-ai/glm-5.3", name: "Glm 5.3" },
    { id: "z-ai/glm-5.3-flash", name: "Glm 5.3 Flash" },
    { id: "z-ai/glm-5.3-flashx", name: "Glm 5.3 Flashx" },
    { id: "z-ai/glm-5.2", name: "Glm 5.2" },
    { id: "xiaomi/mimo-v2.5-pro", name: "Mimo V2.5 Pro" },
    { id: "tencent/hy4-preview", name: "Hy4 Preview" },
    { id: "tencent/hy3", name: "Hy3" },
    { id: "stepfun/step-3.7-flash", name: "Step 3.7 Flash" },
    { id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 3 Super 120b A12b" },
    { id: "sakana/fugu-ultra", name: "Fugu Ultra" },
  ],
  serviceKinds: ["llm"],
  modelsFetcher: { url: "https://inference-api.nousresearch.com/v1/models", type: "openai" },
  passthroughModels: true,
};
