export type CompletionEvent = { type: "text"; text: string } | { type: "length" };

// SSE frames may be split at any byte, including within a UTF-8 character.
export async function* readCompletion(body: ReadableStream<Uint8Array>): AsyncGenerator<CompletionEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let complete = false;
  try {
    while (!complete) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (done && buffer.trim()) buffer += "\n\n";
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        if (data === "[DONE]") { complete = true; break; }
        let event;
        try { event = JSON.parse(data); } catch { throw new Error("The response was interrupted. Please try again."); }
        if (event.error) throw new Error("The provider interrupted the response. Please try again.");
        const choice = event.choices?.[0];
        if (typeof choice?.delta?.content === "string") yield { type: "text", text: choice.delta.content };
        if (choice?.finish_reason === "length") yield { type: "length" };
      }
      if (done) {
        if (!complete) throw new Error("Connection ended before the answer was complete. Please try again.");
        break;
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
