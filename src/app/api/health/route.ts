/**
 * Health check endpoint — public, no auth required.
 * Returns 200 with basic service status for post-deploy smoke tests and uptime monitoring.
 */
export async function GET() {
  return Response.json({
    status: 'ok',
    ts: new Date().toISOString(),
  })
}
