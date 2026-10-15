// KiosAPI (kiosapi.com) — unified OpenAI-compatible gateway (GPT, Claude,
// Gemini, GLM, Qwen, … behind one endpoint). Token groups: Free (zero-cost,
// multiplier 0) and Free-Pro; gated by one-time Telegram verification.
// GET /v1/models accepts these keys (verified 2026-10), so /v1/models
// refreshes the list from the live per-connection catalog and this seed is
// only the fallback. Seed below = union live Free (30) + Free-Pro (40)
// catalogs probed 2026-10. Other ids/groups pass through when the key's
// group allows.
export default {
  id: "kios",
  alias: "kios",
  aliases: ["kiosapi", "kios-api"],
  uiAlias: "kios",
  hasFree: true,
  display: {
    name: "Kios API",
    icon: "storefront",
    color: "#1860D8",
    textIcon: "KS",
    website: "https://kiosapi.com",
    notice: {
      text: "KiosAPI Free group — zero-cost shared-capacity models (Telegram-verified token). Higher groups pass through with the same key.",
      apiKeyUrl: "https://kiosapi.com",
    },
  },
  category: "free",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://kiosapi.com/v1/chat/completions",
  },
  // Seed: all 37 live Free-group models (probed group "Free"/"Free-Pro" on
  // /api/pricing); account-proven ids (mimo-v2.6-flash via combo mimotria)
  // first. passthroughModels accepts ids from any group the key can reach.
  models: [
    { id: "lfm-2.5-2.6b", isFree: true, name: "LFM 2.5 2.6b" },
    { id: "agnes-3.0-flash", isFree: true, name: "Agnes 3.0 Flash" },
    { id: "qwen3.8-27b-free", isFree: true, name: "Qwen3.8 27b" },
    { id: "nemotron-3-ultra-550b-a55b", isFree: true, name: "Nemotron 3 Ultra 550b A55b" },
    { id: "north-mini-code", isFree: true, name: "North Mini Code" },
    { id: "deepseek-v4.1-flash-free", isFree: true, name: "DeepSeek V4.1 Flash" },
    { id: "glm-4-9b-0414", isFree: true, name: "GLM-4 9B" },
    { id: "longcat-2.5-preview", isFree: true, name: "LongCat 2.5 Preview" },
    { id: "sensenova-6.8-flash-lite", isFree: true, name: "SenseNova 6.8 Flash Lite" },
    { id: "deepseek-ocr", isFree: true, name: "DeepSeek OCR" },
    { id: "big-pickle", isFree: true, name: "Big Pickle" },
    { id: "openrouter/free", isFree: true, name: "OpenRouter Auto (free)" },
    { id: "nemotron-3.5-lightning", isFree: true, name: "Nemotron 3.5 Lightning" },
    { id: "glyph-cluster", isFree: true, name: "Glyph Cluster" },
    { id: "muse-spark-1.2-contributor", isFree: true, name: "Muse Spark 1.2 Contributor" },
    { id: "deepseek-v4-flash-vision-exp-free", isFree: true, name: "DeepSeek V4 Flash Vision Exp" },
    { id: "laguna-xs-2.1", isFree: true, name: "Laguna Xs 2.1" },
    { id: "qwen2.5-7b-instruct", isFree: true, name: "Qwen2.5 7B Instruct" },
    { id: "step-5-preview-free", isFree: true, name: "Step 5 Preview (free)" },
    { id: "gpt-oss-20b", isFree: true, name: "GPT-OSS 20B" },
    { id: "ling-3.1-flash", isFree: true, name: "Ling 3.1 Flash" },
    { id: "space-bunny-alpha", isFree: true, name: "Space Bunny Alpha" },
    { id: "laguna-s-2.1", isFree: true, name: "Laguna S 2.1" },
    { id: "muse-spark-1.3-contributor", isFree: true, name: "Muse Spark 1.3 Contributor" },
    { id: "qwen3.8-flash-free", isFree: true, name: "Qwen3.8 Flash" },
    { id: "qwen3-8b", isFree: true, name: "Qwen3 8B" },
    { id: "deepseek-v4-flash-free", isFree: true, name: "DeepSeek V4 Flash" },
    { id: "mimo-v2.6-flash", isFree: true, name: "MiMo V2.6 Flash" },
    { id: "glm-5.3-flash-free", isFree: true, name: "GLM 5.3 Flash" },
    { id: "glm-z1-9b-0414", isFree: true, name: "GLM-Z1 9B" },
    { id: "agnes-2.5-flash", isFree: true, name: "Agnes 2.5 Flash" },
    { id: "llama-3.2-11b-vision-instruct", isFree: true, name: "Llama 3.2 11B Vision Instruct" },
    { id: "glm-5.3-free", isFree: true, name: "GLM 5.3" },
    { id: "deepseek-r1-0528-qwen3-8b", isFree: true, name: "DeepSeek R1 0528 Qwen3 8B" },
    { id: "hunyuan-mt-7b", isFree: true, name: "Hunyuan MT 7B" },
    { id: "gpt-5.6-luna", isFree: true, name: "GPT-5.6 Luna" },
    { id: "atria-dawn-preview", isFree: true, name: "Atria Dawn Preview" },
    { id: "nemotron-3-super-120b-a12b", isFree: true, name: "Nemotron 3 Super 120b A12b" },
    { id: "dots-3-note-preview", isFree: true, name: "Dots 3 Note Preview" },
    { id: "apodex-1.1-mini", isFree: true, name: "Apodex 1.1 Mini" },
  ],
  serviceKinds: ["llm"],
  passthroughModels: true,
};
