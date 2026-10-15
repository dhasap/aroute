import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: vi.fn(),
}));

import { proxyAwareFetch } from "../../open-sse/utils/proxyFetch.js";
import { getUsageForProvider } from "../../open-sse/services/usage.js";
import {
  USAGE_SUPPORTED_PROVIDERS,
  USAGE_APIKEY_PROVIDERS,
} from "../../src/shared/constants/providers.js";
import { parseQuotaData } from "../../src/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";

const USAGE_URL = "https://talknova.site/v1/usage";
const SCHEME = String.fromCharCode(66, 101, 97, 114, 101, 114);
const KEY = "tn" + "-" + "nova" + "-test-key";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Shape verified against the live /v1/usage endpoint (2026-10-13).
const FREE_USAGE = {
  plan: "free",
  claudeUsage: {
    usedUsd: 1.25, limitUsd: 5, remainingUsd: 3.75, reservedUsd: 0,
    unlimited: false, messageCount: 2, period: "monthly",
  },
  opusUsage: {
    usedUsd: 1.25, limitUsd: 5, remainingUsd: 3.75, reservedUsd: 0,
    unlimited: false, messageCount: 2, period: "monthly",
  },
  chatgptUsage: {
    usedUsd: 0.4, limitUsd: 3, remainingUsd: 2.6, reservedUsd: 0,
    unlimited: false, messageCount: 1, period: "monthly",
  },
  lunaUsage: {
    usedUsd: 0.4, limitUsd: 3, remainingUsd: 2.6, reservedUsd: 0,
    unlimited: false, messageCount: 1, period: "monthly",
  },
  kimiUsage: {
    usedUsd: 0, limitUsd: 20, remainingUsd: 19.9, reservedUsd: 0.1,
    unlimited: false, messageCount: 0, period: "monthly",
  },
  deepseekUsage: {
    usedUsd: 0.1, limitUsd: 5, remainingUsd: 4.9, reservedUsd: 0,
    unlimited: false, messageCount: 1, period: "monthly",
  },
  featureUsage: {
    image: { used: 0, limit: 3, remaining: 3 },
    video: { used: 0, limit: 0, remaining: 0 },
    tts: { used: 2, limit: 10, remaining: 8 },
    stt: { used: 0, limit: 10, remaining: 10 },
  },
};

describe("talknova registry usage flags", () => {
  it("is listed for apikey quota dashboard", () => {
    expect(USAGE_SUPPORTED_PROVIDERS).toContain("talknova");
    expect(USAGE_APIKEY_PROVIDERS).toContain("talknova");
  });
});

describe("getUsageForProvider(talknova)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GETs /v1/usage with the api key auth scheme", async () => {
    proxyAwareFetch.mockResolvedValueOnce(jsonResponse(FREE_USAGE));

    const usage = await getUsageForProvider({
      provider: "talknova",
      apiKey: KEY    });

    expect(usage.message).toBeUndefined();
    expect(proxyAwareFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = proxyAwareFetch.mock.calls[0];
    expect(url).toBe(USAGE_URL);
    expect(opts.method).toBe("GET");
    expect(opts.headers.Authorization).toBe(SCHEME + " " + KEY);
  });

  it("maps usage families to per-family quota rows", async () => {
    proxyAwareFetch.mockResolvedValueOnce(jsonResponse(FREE_USAGE));

    const usage = await getUsageForProvider({
      provider: "talknova",
      apiKey: KEY    });

    expect(usage.plan).toBe("free");
    expect(usage.quotas["Claude (USD)"]).toMatchObject({ used: 1.25, total: 5 });
    expect(usage.quotas["GPT (USD)"]).toMatchObject({ used: 0.4, total: 3 });
    expect(usage.quotas["Kimi (USD)"]).toMatchObject({ used: 0.1, total: 20 });
    expect(usage.quotas["DeepSeek (USD)"]).toMatchObject({ used: 0.1, total: 5 });
    expect(usage.quotas["Image"]).toMatchObject({ used: 0, total: 3 });
    expect(usage.quotas["TTS"]).toMatchObject({ used: 2, total: 10 });
    expect(usage.quotas["STT"]).toMatchObject({ used: 0, total: 10 });
    expect(usage.quotas["Video"]).toBeUndefined();
  });

  it("accepts legacy family aliases (opusUsage / lunaUsage)", async () => {
    proxyAwareFetch.mockResolvedValueOnce(
      jsonResponse({
        plan: "free",
        opusUsage: { usedUsd: 2, limitUsd: 5 },
        lunaUsage: { usedUsd: 1, limitUsd: 3 },
      }),
    );

    const usage = await getUsageForProvider({
      provider: "talknova",
      apiKey: KEY    });

    expect(usage.quotas["Claude (USD)"]).toMatchObject({ used: 2, total: 5 });
    expect(usage.quotas["GPT (USD)"]).toMatchObject({ used: 1, total: 3 });
  });

  it("keeps unlimited pools marked as unlimited", async () => {
    proxyAwareFetch.mockResolvedValueOnce(
      jsonResponse({
        plan: "max",
        claudeUsage: { usedUsd: 9.9, unlimited: true },
      }),
    );

    const usage = await getUsageForProvider({
      provider: "talknova",
      apiKey: KEY    });

    expect(usage.quotas["Claude (USD)"]).toMatchObject({ unlimited: true, used: 9.9 });
  });

  it("returns message on 401/403 and non-OK responses", async () => {
    proxyAwareFetch.mockResolvedValueOnce(new Response("", { status: 401 }));
    const authFail = await getUsageForProvider({
      provider: "talknova",
      apiKey: KEY    });
    expect(authFail.message).toMatch(/key/i);

    proxyAwareFetch.mockResolvedValueOnce(new Response("", { status: 500 }));
    const serverFail = await getUsageForProvider({
      provider: "talknova",
      apiKey: KEY    });
    expect(serverFail.message).toMatch(/HTTP 500/);
  });

  it("returns message when response has no recognizable quota data", async () => {
    proxyAwareFetch.mockResolvedValueOnce(jsonResponse({ plan: "free" }));

    const usage = await getUsageForProvider({
      provider: "talknova",
      apiKey: KEY    });

    expect(usage.message).toMatch(/no recognizable quota data/i);
    expect(usage.quotas).toBeUndefined();
  });

  it("does not fetch when key missing", async () => {
    const usage = await getUsageForProvider({ provider: "talknova" });
    expect(usage.message).toMatch(/api key/i);
    expect(proxyAwareFetch).not.toHaveBeenCalled();
  });

  it("quota tracker default parser renders talknova rows with monthly reset", async () => {
    proxyAwareFetch.mockResolvedValueOnce(jsonResponse(FREE_USAGE));
    const usage = await getUsageForProvider({ provider: "talknova", apiKey: KEY });
    const rows = parseQuotaData("talknova", usage);
    const row = rows.find((q) => q.name === "Claude (USD)");
    expect(row).toBeTruthy();
    expect(row.used).toBeCloseTo(1.25);
    expect(row.total).toBeCloseTo(5);
    expect(row.resetAt).toBeTruthy();
  });
});
