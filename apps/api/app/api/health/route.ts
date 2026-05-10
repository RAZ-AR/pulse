export async function GET() {
  return Response.json({ status: "ok", service: "pulse-api", ts: Date.now() })
}
