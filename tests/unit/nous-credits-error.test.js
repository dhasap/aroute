import { describe, it, expect } from "vitest";
import { friendlyUpstreamMessage, parseUpstreamError } from "../../open-sse/utils/error.js";

// What Nous Portal actually returns for a credit-less account hitting a paid model.
const NOUS_BODY = JSON.stringify({
  status: 404,
  message: "Model 'stepfun/step-3.7-flash' requires available credits. Your account balance is too low to use paid models — add credits at https://portal.nousresearch.com or pick a free model.",
  code: "insufficient_credits_for_paid_model",
});

describe("friendlyUpstreamMessage (Nous billing404)", () => {
  it("rewords the known no-credits code into an actionable hint", () => {
    const out = friendlyUpstreamMessage("Model 'x' requires available credits.", "insufficient_credits_for_paid_model");
    expect(out).toContain("no credits");
    expect(out).toContain("https://portal.nousresearch.com");
    expect(out).toContain(":free");
    expect(out).toContain("insufficient_credits_for_paid_model");
    expect(out).toContain("requires available credits"); // keeps upstream context
  });

  it("passes every other message through untouched", () => {
    expect(friendlyUpstreamMessage("Rate limit exceeded", "rate_limit_exceeded")).toBe("Rate limit exceeded");
    expect(friendlyUpstreamMessage("boom", "")).toBe("boom");
    expect(friendlyUpstreamMessage("", "insufficient_credits_for_paid_model")).toContain("no credits");
  });
});

describe("parseUpstreamError (chat path)", () => {
  it("keeps status 404 but rewords the message for the credits code", async () => {
    const res = new Response(NOUS_BODY, { status: 404, headers: { "content-type": "application/json" } });
    const { statusCode, message } = await parseUpstreamError(res);
    expect(statusCode).toBe(404); // fallback/lock behaviour must not change
    expect(message).toContain("no credits");
    expect(message).toContain("insufficient_credits_for_paid_model");
    expect(message).toContain("requires available credits");
  });

  it("leaves ordinary upstream errors exactly as-is", async () => {
    const res = new Response(JSON.stringify({ error: { message: "Rate limit exceeded, try later" } }), { status: 429 });
    const { statusCode, message } = await parseUpstreamError(res);
    expect(statusCode).toBe(429);
    expect(message).toBe("Rate limit exceeded, try later");
  });

  it("handles non-JSON bodies without throwing", async () => {
    const res = new Response("Bad Gateway", { status: 502 });
    const { statusCode, message } = await parseUpstreamError(res);
    expect(statusCode).toBe(502);
    expect(message).toBe("Bad Gateway");
  });
});
