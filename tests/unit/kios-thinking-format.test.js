import { describe, it, expect } from "vitest";
// Kios relay: /v1/chat/completions rejects vendor-native thinking params
// (`enable_thinking`, `thinking:{type}` → 400) even for the models those belong
// to; only OpenAI-style reasoning_effort is accepted (probed live 2026-10-10:
// none/minimal/low/medium/high/xhigh/max all 200 on glm-5.3-free and
// deepseek-v4-flash-free). PROVIDER_CAPABILITIES["kios"] must therefore force
// thinkingFormat:"openai" for GLM/DeepSeek ids, while Qwen keeps the qwen format
// (enable_thinking/budget accepted by kios, THINK:8k in daily use via mimotria).
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";
import { applyThinking } from "../../open-sse/translator/concerns/thinkingUnified.js";

describe("kios relay thinking wire format", () => {
  const forceOpenAI = [
    "glm-5.3-free",
    "glm-5.3-flash-free",
    "deepseek-v4-flash-free",
    "deepseek-v4.1-flash-free",
    "deepseek-v4-flash-vision-exp-free",
  ];

  it.each(forceOpenAI)("forces openai format for %s (no enable_thinking on the wire)", (model) => {
    const caps = getCapabilitiesForModel("kios", model);
    expect(caps.reasoning).toBe(true);
    expect(caps.thinkingFormat).toBe("openai");
  });

  it.each(forceOpenAI)("never emits enable_thinking when thinking is disabled (%s)", (model) => {
    const body = { model, messages: [{ role: "user", content: "hi" }] };
    applyThinking("openai", model, body, "kios", { mode: "none" });
    expect(body.enable_thinking).toBeUndefined();
    expect(body.thinking).toBeUndefined();
    expect(body.reasoning_effort).toBe("none");
  });

  it.each(forceOpenAI)("maps budgeted thinking to reasoning_effort, not thinking_budget (%s)", (model) => {
    const body = { model, messages: [{ role: "user", content: "hi" }] };
    applyThinking("openai", model, body, "kios", { mode: "budget", budget: 8192 });
    expect(body.enable_thinking).toBeUndefined();
    expect(body.thinking).toBeUndefined();
    expect(typeof body.reasoning_effort).toBe("string");
    expect(["low", "medium", "high", "xhigh", "max", "minimal"]).toContain(body.reasoning_effort);
  });

  it("keeps qwen format for qwen3.8-flash-free (enable_thinking accepted by kios)", () => {
    const caps = getCapabilitiesForModel("kios", "qwen3.8-flash-free");
    expect(caps.thinkingFormat).toBe("qwen");
    const levels = getThinkingLevels("kios", "qwen3.8-flash-free");
    expect(levels).toContain("none");
    expect(levels).toContain("high");
  });

  it("does not leak the override to non-kios GLM (pattern zai caps intact)", () => {
    const caps = getCapabilitiesForModel(null, "glm-5.3");
    expect(caps.thinkingFormat).toBe("zai");
  });

  it("keeps vision flag on deepseek-v4-flash-vision-exp-free", () => {
    const caps = getCapabilitiesForModel("kios", "deepseek-v4-flash-vision-exp-free");
    expect(caps.vision).toBe(true);
  });
});
