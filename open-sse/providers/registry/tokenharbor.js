// TokenHarbor (tokenharbor.ai) — OpenAI-compatible AI gateway ("One API for
// the world's leading AI models"). One universal key (`thk_live_…`), real
// per-token pricing, free lane via `:free` model suffixes (zero-priced,
// verified live 2026-10). Both /v1/chat/completions and /v1/models accept
// `Authorization: Bearer <key>`. Non-free model ids pass through with the
// same key (passthroughModels).
export default {
  id: "tokenharbor",
  priority: 60,
  hasFree: true,
  alias: "tokenharbor",
  aliases: ["token-harbor", "harbor"],
  uiAlias: "tokenharbor",
  display: {
    name: "TokenHarbor",
    icon: "storefront",
    color: "#0E9F8A",
    textIcon: "TH",
    website: "https://tokenharbor.ai",
    notice: {
      text: "TokenHarbor — one key across 70+ routed models. Free lane: `:free` suffix models (zero-priced).",
      apiKeyUrl: "https://tokenharbor.ai",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://tokenharbor.ai/v1/chat/completions",
    validateUrl: "https://tokenharbor.ai/v1/models",
  },
  modelsFetcher: { url: "https://tokenharbor.ai/v1/models", type: "openai-compatible" },
  // Seed: all 4 live `:free` models (probed 200 on chat/completions).
  models: [
    { id: "deepseek-v4.1-flash:free", isFree: true, name: "DeepSeek V4.1 Flash (Free)" },
    { id: "deepseek-v4-flash:free", isFree: true, name: "DeepSeek V4 Flash (Free)" },
    { id: "mimo-v2.6-flash:free", isFree: true, name: "MiMo V2.6 Flash (Free)" },
    { id: "mimo-v2.5:free", isFree: true, name: "MiMo V2.5 (Free)" },
  ],
  passthroughModels: true,
};
