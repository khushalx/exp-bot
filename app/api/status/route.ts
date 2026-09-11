import { env } from "cloudflare:workers";
export async function GET() {
  const configured = Boolean((env as unknown as { GROQ_API_KEY?: string }).GROQ_API_KEY?.trim());
  return Response.json({ configured }, { headers: { "Cache-Control": "no-store" } });
}
