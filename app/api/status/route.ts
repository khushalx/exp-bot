export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(process.env.GROQ_API_KEY?.trim());
  return Response.json({ configured }, { headers: { "Cache-Control": "no-store" } });
}
