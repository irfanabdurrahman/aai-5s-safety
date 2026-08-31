import { describe, expect, it } from "vitest";
import { readOpenAiChatStream } from "./ai-stream";

function chunkedStream(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readOpenAiChatStream", () => {
  it("merangkai delta yang terpecah antar network chunk", async () => {
    const stream = chunkedStream([
      'data: {"choices":[{"delta":{"content":"Halo',
      ' "}}]}\n\ndata: {"choices":[{"delta":{"content":"Safety"}}]}\r\n',
      'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":4}}\n',
      "data: [DONE]\n\n",
    ]);

    const parts = [];
    for await (const part of readOpenAiChatStream(stream)) parts.push(part);

    expect(parts).toEqual([
      { content: "Halo ", promptTokens: undefined, completionTokens: undefined },
      { content: "Safety", promptTokens: undefined, completionTokens: undefined },
      { content: undefined, promptTokens: 12, completionTokens: 4 },
    ]);
  });

  it("tidak pernah meneruskan reasoning_content", async () => {
    const stream = chunkedStream([
      'data: {"choices":[{"delta":{"reasoning_content":"rahasia internal"}}]}\n',
      'data: {"choices":[{"delta":{"content":"Jawaban final"}}]}\n',
      "data: [DONE]\n",
    ]);

    const parts = [];
    for await (const part of readOpenAiChatStream(stream)) parts.push(part);

    expect(parts).toEqual([
      {
        content: "Jawaban final",
        promptTokens: undefined,
        completionTokens: undefined,
      },
    ]);
  });
});
