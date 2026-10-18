// Dahl Global (inference.dahl.global) — free-tier OpenAI-compatible inference
// API ("First 100M tokens free"). Verified live 2026-10-19: /v1/models exposes
// 3 models; MiniMax + GLM chat verified, DeepSeek subject to upstream
// free-tier concurrency (429 model_concurrency, transient).
export default {
  id: "dahlglobal",
  alias: "dahl",
  aliases: ["dahl-global", "dahl-global-inference"],
  uiAlias: "dahlglobal",
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  display: {
    name: "Dahl Global",
    color: "#F70302",
    textIcon: "D",
    website: "https://inference.dahl.global",
    notice: {
      text: "Free-tier OpenAI-compatible inference (first 100M tokens free). 3 models — MiniMax M2.7, GLM 5.3 Flash, DeepSeek V4 Flash. Free accounts share upstream concurrency, so a model may occasionally return 429 (model_concurrency) — retry or switch model.",
      apiKeyUrl: "https://inference.dahl.global",
    },
    authHint: "API key from inference.dahl.global (format dahl_...).",
  },
  transport: {
    baseUrl: "https://inference.dahl.global/v1/chat/completions",
    validateUrl: "https://inference.dahl.global/v1/models",
  },
  models: [
    { id: "MiniMaxAI/MiniMax-M2.7", isFree: true, name: "MiniMax M2.7", reasoning: true },
    { id: "zai-org/GLM-5.3-Flash", isFree: true, name: "GLM 5.3 Flash", reasoning: true },
    { id: "deepseek-ai/DeepSeek-V4-Flash-0731", isFree: true, name: "DeepSeek V4 Flash 0731" },
  ],
  passthroughModels: false,
};
