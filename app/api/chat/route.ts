import { env } from "cloudflare:workers";
import { createChatHandler } from "@/lib/chat-handler";
export const POST = createChatHandler(() => (env as unknown as { GROQ_API_KEY?: string }).GROQ_API_KEY);
