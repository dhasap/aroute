// Atria AI (Nous Research / Atria-ASI) — OpenAI-compatible gateway.
// NOTE: auth is `x-api-key: raw`, NOT Bearer (both /models and /chat/completions
// reject `Authorization: Bearer` with "invalid_api_key"; x-api-key works).
export default {
  id: "atria",
  priority: 60,
  hasFree: true,
  alias: "atria",
  uiAlias: "atria",
  display: {
    name: "Atria AI",
    icon: "bolt",
    color: "#6D28D9",
    textIcon: "AT",
    website: "https://www.atria-asi.ai",
    notice: {
      text: "Atria AI — Atria-Dawn-Preview (1M context).",
      apiKeyUrl: "https://www.atria-asi.ai",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.atria-asi.ai/v1/chat/completions",
    validateUrl: "https://api.atria-asi.ai/v1/models",
    auth: { combined: true, header: "x-api-key", scheme: "raw" },
  },
  models: [
    { id: "Atria-Dawn-Preview", name: "Atria Dawn Preview" },
  ],
  passthroughModels: true,
};
