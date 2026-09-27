// Health check for the deploy workflow and uptime monitors. `build` is the
// git commit the running image was built from, so the deploy can confirm the
// NEW version is serving (not just that something answers).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, build: process.env.GIT_SHA ?? "dev" });
}
