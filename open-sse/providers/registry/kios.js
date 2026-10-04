// KiosAPI (kiosapi.com) — unified OpenAI-compatible gateway (GPT, Claude,
// Gemini, GLM, Qwen, … behind one endpoint). This deployment uses the FREE
// token group: 37 zero-cost models (group multiplier 0), gated by one-time
// Telegram verification. Model ids come from the live /api/pricing catalog
// (group filter "Free"/"Free-Pro"); other ids/groups pass through when the
// key's group allows. NOTE: GET /v1/models is token-scoped and rejects these
// keys, so there is no modelsFetcher/validateUrl — chat completions work.
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
    { id: "mimo-v2.6-flash", isFree: true, name: "MiMo V2.6 Flash" },
    { id: "glm-5.3-flash-free", isFree: true, name: "GLM 5.3 Flash" },
    { id: "qwen3.8-flash-free", isFree: true, name: "Qwen3.8 Flash" },
    { id: "deepseek-v4.1-flash-free", isFree: true, name: "DeepSeek V4.1 Flash" },
    { id: "muse-spark-1.3-contributor", isFree: true, name: "Muse Spark 1.3 Contributor" },
    { id: "agnes-2.0-flash", isFree: true, name: "Agnes 2.0 Flash" },
    { id: "agnes-2.5-flash", isFree: true, name: "Agnes 2.5 Flash" },
    { id: "agnes-3.0-flash", isFree: true, name: "Agnes 3.0 Flash" },
    { id: "apodex-1.1-mini", isFree: true, name: "Apodex 1.1 Mini" },
    { id: "atria-dawn-preview", isFree: true, name: "Atria Dawn Preview" },
    { id: "big-pickle", isFree: true, name: "Big Pickle" },
    { id: "deepseek-v4-flash-free", isFree: true, name: "DeepSeek V4 Flash" },
    { id: "deepseek-v4-flash-vision-exp-free", isFree: true, name: "DeepSeek V4 Flash Vision Exp" },
    { id: "diffusiongemma-26b-a4b-it", isFree: true, name: "DiffusionGemma 26b A4b IT" },
    { id: "dots-3-note-preview", isFree: true, name: "Dots 3 Note Preview" },
    { id: "fledge-alpha", isFree: true, name: "Fledge Alpha" },
    { id: "glm-5.3-free", isFree: true, name: "GLM 5.3" },
    { id: "grok-4.5-free", isFree: true, name: "Grok 4.5" },
    { id: "grok-4.7-free", isFree: true, name: "Grok 4.7" },
    { id: "kilo-auto", isFree: true, name: "Kilo Auto" },
    { id: "kimi-k3-free", isFree: true, name: "Kimi K3" },
    { id: "laguna-s-2.1", isFree: true, name: "Laguna S 2.1" },
    { id: "laguna-xs-2.1", isFree: true, name: "Laguna Xs 2.1" },
    { id: "lfm-2.5-2.6b", isFree: true, name: "LFM 2.5 2.6b" },
    { id: "ling-3.0-flash-sante", isFree: true, name: "Ling 3.0 Flash Sante" },
    { id: "ling-3.1-flash", isFree: true, name: "Ling 3.1 Flash" },
    { id: "longcat-2.5-preview", isFree: true, name: "LongCat 2.5 Preview" },
    { id: "mimo-v2.5", isFree: true, name: "MiMo V2.5" },
    { id: "muse-spark-1.2-contributor", isFree: true, name: "Muse Spark 1.2 Contributor" },
    { id: "nemotron-3-super-120b-a12b", isFree: true, name: "Nemotron 3 Super 120b A12b" },
    { id: "nemotron-3-ultra-550b-a55b", isFree: true, name: "Nemotron 3 Ultra 550b A55b" },
    { id: "nemotron-3.5-lightning", isFree: true, name: "Nemotron 3.5 Lightning" },
    { id: "north-mini-code", isFree: true, name: "North Mini Code" },
    { id: "qwen3.8-27b-free", isFree: true, name: "Qwen3.8 27b" },
    { id: "sensenova-6.8-flash-lite", isFree: true, name: "SenseNova 6.8 Flash Lite" },
    { id: "space-bunny-alpha", isFree: true, name: "Space Bunny Alpha" },
    { id: "step-3.7-flash", isFree: true, name: "Step 3.7 Flash" },
  ],
  serviceKinds: ["llm"],
  passthroughModels: true,
};
