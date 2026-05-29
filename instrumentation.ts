export async function register() {
  // Only start node-cron in long-running environments (Render/local)
  // Vercel is serverless — it uses vercel.json crons instead
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL) {
    const { startCronJobs } = await import('./lib/cron')
    startCronJobs().catch(console.error)

    // Ensure member passwords exist (build-time seed may not have DATABASE_URL on Render)
    const { seedMemberLogins } = await import('./lib/seed-member-logins')
    seedMemberLogins().catch(err => console.error('[Auth] seedMemberLogins failed:', err))
  }
}
