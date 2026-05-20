export async function GET() {
  return Response.json({ status: "ok", service: "ayoo-api", ts: Date.now() })
}
