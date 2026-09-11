import { z } from "zod";
const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(24000) })).min(1).max(100),
  effort: z.enum(["low", "medium", "high"]).default("medium"),
});
const fail = (error: string, status: number, code?: string) => Response.json({ error, code }, { status, headers: { "Cache-Control": "no-store" } });
export function createChatHandler(getKey: () => string | undefined, upstreamFetch: typeof fetch = fetch) {
  return async function POST(request: Request) {
    const origin = request.headers.get("origin");
    if (origin) {
      // Next.js may reconstruct request.url with an internal hostname. Compare
      // against the actual incoming Host header, not arbitrary forwarded hosts.
      try {
        const source = new URL(origin);
        const host = request.headers.get("host") ?? new URL(request.url).host;
        if (!["https:", "http:"].includes(source.protocol) || source.host !== host) return fail("This request is not allowed.", 403);
      } catch { return fail("This request is not allowed.", 403); }
    }
    if (!request.headers.get("content-type")?.includes("application/json")) return fail("Send a JSON message.", 415);
    if (Number(request.headers.get("content-length")) > 200000) return fail("This conversation is too long. Start a new conversation.", 413);
    let payload;
    try {
      const text = await request.text();
      if (text.length > 200000) return fail("This conversation is too long. Start a new conversation.", 413);
      payload = schema.safeParse(JSON.parse(text));
    } catch { return fail("The message could not be read. Please try again.", 400); }
    if (!payload.success) return fail("Keep messages under 24,000 characters and conversations under 100 messages.", 400);
    if (payload.data.messages.at(-1)?.role !== "user") return fail("The last message must be from you.", 400);
    const key = getKey()?.trim();
    if (!key) return fail("Set GROQ_API_KEY in your server environment, then restart locally or redeploy on Vercel.", 503, "MISSING_KEY");
    try {
      const upstream = await upstreamFetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [{ role: "system", content: "You are Oddly, a warm, thoughtful AI companion for curious minds. Be clear, useful, creative when appropriate, and concise unless depth is needed. Use Markdown for readability. Avoid canned enthusiasm. Be honest about uncertainty. You have no web browsing or code execution tools; do not claim to search the web, run code, or know live information." }, ...payload.data.messages],
          reasoning_effort: payload.data.effort, include_reasoning: false, max_completion_tokens: 8192, temperature: 0.7, stream: true,
        }),
      });
      if (!upstream.ok) {
        await upstream.body?.cancel();
        if ([401, 403].includes(upstream.status)) return fail("Groq could not authorize this request. Check your API key and model permissions, then restart the app.", 401);
        if (upstream.status === 429) return fail("Groq’s rate limit was reached. Give it a moment, then try again.", 429);
        if (upstream.status === 400 || upstream.status === 413) return fail("Groq could not process this conversation. Try a shorter message or start a new conversation.", 400);
        return fail("Groq is unavailable right now. Please try again in a moment.", 502);
      }
      if (!upstream.body) return fail("No response came back from Groq. Please try again.", 502);
      return new Response(upstream.body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
    } catch { return fail(request.signal.aborted ? "The reply was stopped." : "Could not reach Groq in time. Check your connection and try again.", 504); }
  };
}
