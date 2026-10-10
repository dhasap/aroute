import { describe, it, expect } from "vitest";
// DeepSeek V4.x (dsml) encodes tool calls with special tokens delimited by the
// fullwidth bar U+FF5C: <｜｜DSML｜｜tool_calls> … </｜｜DSML｜｜DSML｜>.
// Probed live 2026-10-11 against kios/deepseek-v4.1-flash-free (served as
// deepseek-ai/deepseek-v4.1-flash) via /v1/chat/completions with a tool prompt:
// the tool call arrived correctly in tool_calls, but the SSE ALSO carried the
// markup stub in the text channel, split across two deltas —
//   delta.content = "\n\n<"      (chunk 1)
//   delta.content = "｜DSML｜ calls>\n" (chunk 2)
// so clients rendered "<｜｜DSML｜｜ calls>" as assistant prose. The sibling
// models (DeepSeek-V4-Flash, DeepSeek-V4-Flash-Vision-Exp) send "\n\n\n" instead —
// the scrubber must make the v4.1 stream match them.
import {
  scrubLeakedMarkup,
  scrubLeakedMarkupTail,
  createLeakedMarkupScrubber,
  scrubChunkContent,
  scrubResponseText,
} from "open-sse/utils/leakedMarkup.js";
import { createSSEStream } from "open-sse/utils/stream.js";
import { FORMATS } from "open-sse/translator/formats.js";

const BAR = "\uFF5C";
const DSML = "DSML";
// Exactly the two text deltas captured from the live upstream.
const LEAK_CHUNKS = ["\n\n<", `${BAR}DSML${BAR} calls>\n`];
const LEAK_FULL = LEAK_CHUNKS.join("");

function sseChunk(delta) {
  return `data: ${JSON.stringify({
    id: "chatcmpl-x",
    object: "chat.completion.chunk",
    created: 1,
    model: "deepseek-v4.1-flash",
    choices: [{ index: 0, delta, finish_reason: null }],
  })}\n\n`;
}

async function runPassthrough(inputSse) {
  const stream = createSSEStream({ mode: "passthrough", provider: "kios", model: "auto-deepseek" });
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const collect = (async () => {
    let out = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
    return out;
  })();

  for (const part of inputSse) await writer.write(encoder.encode(part));
  await writer.close();
  return collect;
}

function contentOf(sseOut) {
  let text = "";
  for (const line of sseOut.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      text += JSON.parse(payload)?.choices?.[0]?.delta?.content || "";
    } catch { /* ignore */ }
  }
  return text;
}

describe("leaked tool-call markup (DeepSeek dsml)", () => {
  it("removes a complete marker from a whole string", () => {
    expect(scrubLeakedMarkup(LEAK_FULL)).toBe("\n\n\n");
    expect(scrubLeakedMarkup("done " + LEAK_FULL + " ok")).toBe("done \n\n\n ok");
    expect(scrubLeakedMarkup(`<${BAR}DSML${BAR}tool_calls>text`)).toBe("text");
  });

  it("removes a mangled stub whose tag lost its leading '<'", () => {
    expect(scrubLeakedMarkup(`${BAR}DSML${BAR} calls>\n`)).toBe("\n");
    expect(scrubLeakedMarkup(`${BAR}DSML${BAR}`)).toBe("");
  });

  it("removes the bare special token but keeps the words around it", () => {
    // The origin of the format learned the hard way: these delimiters never
    // belong in text. A tool that merely quotes the markup loses the delimiters,
    // not the sentence — the stub body is only eaten when it terminates in ">".
    expect(scrubLeakedMarkup(`the ${BAR}${DSML}${BAR} sequence`)).toBe("the  sequence");
    expect(scrubLeakedMarkup(`a${BAR}${DSML}${BAR}b`)).toBe("ab");
    expect(scrubLeakedMarkup("halo <div> apa kabar")).toBe("halo <div> apa kabar");
  });

  it("leaves ordinary prose untouched (fast path, no marker word)", () => {
    const prose = "Use <div> and the tool_calls array; 1 < 2.";
    expect(scrubLeakedMarkup(prose)).toBe(prose);
  });

  it("drops an unterminated marker at end of stream, keeps real trailing text", () => {
    expect(scrubLeakedMarkupTail(`\n\n<${BAR}DSML${BAR} calls`)).toBe("\n\n");
    expect(scrubLeakedMarkupTail("\n\n<")).toBe("\n\n<");
  });

  it("scrubs the live two-delta split through the stateful scrubber", () => {
    const scrubber = createLeakedMarkupScrubber();
    const first = scrubber.push(LEAK_CHUNKS[0]);
    const second = scrubber.push(LEAK_CHUNKS[1]);
    expect(first + second).toBe("\n\n\n");
    expect(first + second).not.toContain("DSML");
    expect(scrubber.flush()).toBe("");
  });

  it("holds back only marker prefixes — a trailing '<' of real text survives", () => {
    const scrubber = createLeakedMarkupScrubber();
    expect(scrubber.push("answer: ")).toBe("answer: ");
    expect(scrubber.push("<")).toBe("");          // held: could start a marker
    expect(scrubber.push("div>")).toBe("<div>");  // released: real text
  });

  it("scrubs an OpenAI delta in place and reports the change", () => {
    const scrubber = createLeakedMarkupScrubber();
    const chunk = { choices: [{ index: 0, delta: { content: LEAK_FULL }, finish_reason: null }] };
    expect(scrubChunkContent(chunk, scrubber, FORMATS.OPENAI)).toBe(true);
    expect(chunk.choices[0].delta.content).toBe("\n\n\n");

    const clean = { choices: [{ index: 0, delta: { content: "hello" } }] };
    expect(scrubChunkContent(clean, scrubber, FORMATS.OPENAI)).toBe(false);
    expect(clean.choices[0].delta.content).toBe("hello");
  });

  it("drops an emptied content field instead of sending an empty delta", () => {
    const chunk = { choices: [{ index: 0, delta: { content: `${BAR}DSML${BAR} calls>`, tool_calls: [{ index: 0 }] } }] };
    const scrubber = createLeakedMarkupScrubber();
    expect(scrubChunkContent(chunk, scrubber, FORMATS.OPENAI)).toBe(true);
    expect(chunk.choices[0].delta.content).toBeUndefined();
    expect(chunk.choices[0].delta.tool_calls).toHaveLength(1);
  });

  it("scrubs a complete non-streaming body in every shape it can appear in", () => {
    const body = {
      choices: [{ message: { role: "assistant", content: LEAK_FULL, tool_calls: [{ id: "call_1" }] } }],
    };
    expect(scrubResponseText(body)).toBe(true);
    expect(body.choices[0].message.content).toBe("\n\n\n");
    expect(body.choices[0].message.tool_calls).toHaveLength(1);

    const claude = { content: [{ type: "text", text: LEAK_FULL }] };
    expect(scrubResponseText(claude)).toBe(true);
    expect(claude.content[0].text).toBe("\n\n\n");
  });

  it("keeps usage from a chunk the scrub emptied", async () => {
    // A chunk carrying ONLY leaked markup is otherwise dropped as empty; if it also
    // carried usage, that total must survive the drop (the stream may end without a
    // finish chunk, in which case this usage is the only accounting there is).
    let captured = null;
    const stream = createSSEStream({
      mode: "passthrough",
      provider: "kios",
      model: "auto-deepseek",
      onStreamComplete: (content, usage) => { captured = { content, usage }; },
    });
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    const encoder = new TextEncoder();
    const drain = (async () => { for (;;) { if ((await reader.read()).done) break; } })();

    const leakOnly = `data: ${JSON.stringify({
      id: "chatcmpl-x",
      object: "chat.completion.chunk",
      created: 1,
      model: "m",
      choices: [{ index: 0, delta: { content: `${BAR}DSML${BAR} calls>` }, finish_reason: null }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })}\n\n`;
    await writer.write(encoder.encode(leakOnly));
    await writer.close();
    await drain;

    // extractUsage() normalizes the OpenAI shape to prompt/completion (+ detail
    // fields) — total_tokens is deliberately not carried through, so assert those.
    expect(captured.usage?.prompt_tokens).toBe(10);
    expect(captured.usage?.completion_tokens).toBe(5);
  });

  it("keeps the leak out of the client stream end to end (passthrough)", async () => {
    // The exact upstream framing: the two text deltas plus the real tool call.
    const input = [
      sseChunk({ content: LEAK_CHUNKS[0] }),
      sseChunk({ content: LEAK_CHUNKS[1] }),
      sseChunk({ tool_calls: [{ index: 0, id: "call_1", function: { name: "get_weather", arguments: '{"city":"Bandung"}' } }] }),
      `data: ${JSON.stringify({ id: "chatcmpl-x", object: "chat.completion.chunk", created: 1, model: "m", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}\n\n`,
      "data: [DONE]\n\n",
    ];
    const out = await runPassthrough(input);
    const text = contentOf(out);
    expect(text).toBe("\n\n\n");
    expect(text).not.toContain("DSML");
    expect(out).not.toContain("DSML");
    expect(out).toContain("get_weather");
    expect(out).toContain("[DONE]");
  });
});
