// TalkNova — official OpenAI-compatible reseller (talknova.site).
// Every model below is available on the Free plan (per /api/models minimumPlan).
// Image models (gpt-image-2, gpt-image-2-mini, mai-image-2.5) are intentionally
// excluded: the docs state image generation is only available in website chat.
//
// Quota/rate tracking: TalkNova meters usage per API key (docs "Rate Limits &
// Usage") and exposes GET /v1/usage — see open-sse/services/usage/talknova.js.

export default {
  id: "talknova",
  alias: "talknova",
  uiAlias: "talknova",
  display: {
    name: "TalkNova",
    icon: "bolt",
    color: "#E5E5E5",
    textIcon: "TN",
    website: "https://talknova.site",
    notice: {
      apiKeyUrl: "https://talknova.site/api-access",
    },
  },
  category: "free",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://talknova.site/v1/chat/completions",
    validateUrl: "https://talknova.site/v1/models",
  },
  models: [
    { id: "claude-opus-5.5", isFree: true, name: "Claude Opus 5.5" },
    { id: "claude-sonnet-5.5", isFree: true, name: "Claude Sonnet 5.5" },
    { id: "claude-sonnet-4.5", isFree: true, name: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4.5", isFree: true, name: "Claude Haiku 4.5" },
    { id: "gpt-5.6-sol", isFree: true, name: "GPT-5.6 Sol" },
    { id: "gpt-5.4", isFree: true, name: "GPT-5.4" },
    { id: "gpt-4.1", isFree: true, name: "GPT-4.1" },
    { id: "gpt-4o", isFree: true, name: "GPT-4o" },
    { id: "deepseek-v4.1-flash", isFree: true, name: "DeepSeek V4.1 Flash" },
    { id: "gpt-6-astra", isFree: true, name: "GPT-6 Astra" },
    { id: "kimi-k3", isFree: true, name: "Kimi K3" },
    { id: "claude-fable-5.1", isFree: true, name: "Claude Fable 5.1" },
    { id: "deepseek-v4-pro", isFree: true, name: "DeepSeek V4 Pro" },
    { id: "exp-claude-opus-5.5", isFree: true, name: "Experimental Claude Opus 5.5" },
    { id: "exp-claude-sonnet-5.5", isFree: true, name: "Experimental Claude Sonnet 5.5" },
    { id: "exp-gpt-6-sol", isFree: true, name: "Experimental GPT-6 Sol" },
    { id: "exp-gpt-6-luna", isFree: true, name: "Experimental GPT-6 Luna" },
  ],
  passthroughModels: true,
  serviceKinds: ["llm"],
  features: {
    usage: true,
    usageApikey: true,
  },
};
