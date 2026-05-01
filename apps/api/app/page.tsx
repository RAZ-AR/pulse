export default function ApiRoot() {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>PULSE API</h1>
      <p>tRPC endpoint: <code>/api/trpc</code></p>
      <p>Health: <a href="/api/health">/api/health</a></p>
    </main>
  )
}
