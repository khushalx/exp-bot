import { createChatHandler } from "@/lib/chat-handler";

export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = createChatHandler(() => process.env.GROQ_API_KEY);
