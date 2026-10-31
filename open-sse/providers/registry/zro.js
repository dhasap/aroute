export default {
  id: "zro",
  alias: "zro",
  aliases: ["moonmath", "moonmath-ai"],
  uiAlias: "zro",
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  display: {
    name: "Zro",
    icon: "zero",
    color: "#FFFFFF",
    textIcon: "Z",
    website: "https://zro.moonmath.ai",
    notice: {
      apiKeyUrl: "https://zro.moonmath.ai",
      text: "Free tier — daily request quota per account, resets every 24h.",
    },
  },
  transport: {
    baseUrl: "https://zro.moonmath.ai/v1/chat/completions",
    validateUrl: "https://zro.moonmath.ai/v1/models",
  },
  models: [
    { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", contextLength: 1048576 },
    { id: "glm-5.3-flash", name: "GLM 5.3 Flash", contextLength: 1048576 },
  ],
};
