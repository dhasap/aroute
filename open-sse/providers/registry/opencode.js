export default {
  id: "opencode",
  priority: 40,
  hasFree: true,
  alias: "oc",
  uiAlias: "oc",
  display: {
    name: "OpenCode Free",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OC",
  },
  category: "free",
  noAuth: true,
  transport: {
    baseUrl: "https://opencode.ai",
    baseUrls: [
      "https://opencode.ai",
      "https://opencode.ai",
      "https://opencode.ai",
      "https://opencode.ai",
    ],
    headers: {
      "x-opencode-client": "desktop",
    },
    // Inference rejects non-streaming free requests with 403 FreeTierError:
    // always stream upstream; chatCore's forced-SSE→JSON path serves non-stream clients.
    forceStream: true,
    noAuth: true,
    // Upstream admission flaps in waves: ~10-30% of fully compliant requests get
    // 403 FreeTierError even with the exact CLI fingerprint, and windows come and
    // go (measured: same bytes succeed 10/10 then 0/10 minutes later, and node vs
    // python clients diverge only because of timing, not request content).
    // Plain retry is the only viable strategy — 4 fallback URLs × attempts.
    retry: {
      403: { attempts: 6, delayMs: 400 },
    },
    quirks: {
      forceAutoToolChoiceModels: ["muse-spark-1.3-contributor-free"],
    },
  },
  models: [
    // Endpoint formats differ per model, so declare non-chat models explicitly.
    { id: "muse-spark-1.2-contributor-free", name: "Muse Spark 1.2 Contributor Free", targetFormat: "openai-responses" },
    { id: "muse-spark-1.3-contributor-free", name: "Muse Spark 1.3 Contributor Free", targetFormat: "openai-responses" },
  ],
  modelsFetcher: { url: "https://opencode.ai/inference/v1/models", type: "opencode-free" },
  passthroughModels: true,
};
