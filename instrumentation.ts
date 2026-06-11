export async function register() {
  // Only start node-cron in long-running environments (Render/local)
  // Vercel is serverless — it uses vercel.json crons instead
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL) {
    // Safety net: a detached background task (image fetch, fire-and-forget
    // notification, etc.) that rejects must not crash the whole server.
    process.on('unhandledRejection', (reason) => {
      console.error('[unhandledRejection]', reason)
    })
    process.on('uncaughtException', (err) => {
      console.error('[uncaughtException]', err)
    })

    const { startCronJobs } = await import('./lib/cron')
    startCronJobs().catch(console.error)

    // Bootstrap an EMPTY database only (first boot after a fresh/migrated DB).
    // Running the hardcoded roster restore on every boot would resurrect
    // deleted members and overwrite edited numbers/teams, so gate on count.
    try {
      const { prisma } = await import('./lib/prisma')
      const memberCount = await prisma.teamMember.count()
      if (memberCount === 0) {
        const { restoreQcData } = await import('./lib/restore-qc-data')
        await restoreQcData()
        console.log('[Restore] Empty DB bootstrapped with default roster.')
      }
    } catch (err) {
      console.error('[Restore] bootstrap check failed:', err)
    }

    // Ensure member passwords exist (build-time seed may not have DATABASE_URL on Render)
    const { seedMemberLogins } = await import('./lib/seed-member-logins')
    seedMemberLogins().catch(err => console.error('[Auth] seedMemberLogins failed:', err))
  }
}
