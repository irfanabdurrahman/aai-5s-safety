export type ProviderStreamPart = {
  content?: string;
  promptTokens?: number;
  completionTokens?: number;
};

type ProviderStreamPayload = {
  choices?: Array<{
    delta?: { content?: string | null; reasoning_content?: string | null };
    message?: { content?: string | null };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: unknown;
};

function parseDataLine(line: string): ProviderStreamPart | "DONE" | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":")) return null;
  if (!trimmed.startsWith("data:")) return null;

  const data = trimmed.slice(5).trim();
  if (!data) return null;
  if (data === "[DONE]") return "DONE";

  let payload: ProviderStreamPayload;
  try {
    payload = JSON.parse(data) as ProviderStreamPayload;
  } catch {
    throw new Error("Format streaming dari layanan AI tidak valid.");
  }
  if (payload.error) {
    throw new Error("Layanan AI menghentikan proses sebelum jawaban selesai.");
  }

  // reasoning_content sengaja tidak diteruskan agar chain-of-thought internal
  // provider tidak pernah tampil di browser.
  const content =
    payload.choices?.[0]?.delta?.content ??
    payload.choices?.[0]?.message?.content ??
    undefined;
  const promptTokens = payload.usage?.prompt_tokens;
  const completionTokens = payload.usage?.completion_tokens;

  if (!content && promptTokens === undefined && completionTokens === undefined) {
    return null;
  }
  return { content: content || undefined, promptTokens, completionTokens };
}

export async function* readOpenAiChatStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ProviderStreamPart> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        const part = parseDataLine(line);
        if (part === "DONE") return;
        if (part) yield part;
        newline = buffer.indexOf("\n");
      }

      if (done) {
        const part = parseDataLine(buffer.replace(/\r$/, ""));
        if (part && part !== "DONE") yield part;
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
