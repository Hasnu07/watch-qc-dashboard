#!/usr/bin/env node
/**
 * Backfill Task.assignee_ids from legacy team_member_id for rows that have
 * an assignee but an empty assignee_ids array. Safe to run repeatedly.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tasks = await prisma.task.findMany({
    where: {
      team_member_id: { not: null },
      assignee_ids: { equals: [] },
    },
    select: { id: true, team_member_id: true },
  })

  if (!tasks.length) {
    console.log('[backfill-task-assignees] Nothing to backfill')
    return
  }

  let updated = 0
  for (const task of tasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: { assignee_ids: [task.team_member_id] },
    })
    updated++
  }

  console.log(`[backfill-task-assignees] Backfilled ${updated} task(s)`)
}

main()
  .catch(err => {
    console.error('[backfill-task-assignees] Failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
