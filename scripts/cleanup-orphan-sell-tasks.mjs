// One-time cleanup: delete SELL-phase tasks for watches that are not Sell-type.
// These are leftovers from when "Mark as Sold" used to create sell tasks.
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const orphans = await prisma.watchTask.findMany({
  where: { phase: 'SELL', watch: { watch_type: { not: 'SELL' } } },
  include: { watch: { select: { id: true, name: true, watch_type: true, is_sold: true } } },
})

console.log(`Found ${orphans.length} orphan SELL tasks`)
for (const t of orphans) {
  console.log(`  - Task #${t.id} (${t.task_type}) on watch #${t.watch.id} "${t.watch.name}" [watch_type=${t.watch.watch_type}, is_sold=${t.watch.is_sold}]`)
}

if (orphans.length > 0) {
  const result = await prisma.watchTask.deleteMany({
    where: { phase: 'SELL', watch: { watch_type: { not: 'SELL' } } },
  })
  console.log(`Deleted ${result.count} orphan SELL tasks`)
}

await prisma.$disconnect()
