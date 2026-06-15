import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { visibleWatchFilter } from '@/lib/watch-visibility'
import { getTaskLabel } from '@/lib/task-labels'
import { collapseAccessoryPendingTasks, effectiveWatchPendingCount } from '@/lib/accessory-tasks'
import { getOrInitPipelineTimerEpoch, pipelineStartedAtIso } from '@/lib/pipeline-timer-server'
import {
  isBlockingWatchTask,
  computeHealthScore,
  healthLabel,
  maxOverdueLabel,
  type PendingDashboardResponse,
  type PendingWatchGroup,
  type PendingWatchTask,
} from '@/lib/pending-dashboard'
import { getPipelineUrgency } from '@/lib/pipeline-timer'
import { getSessionFromRequest, isMaster, namesMatch } from '@/lib/auth'

export const dynamic = 'force-dynamic'


function nameMatches(assignee: string | null, memberName: string): boolean {
  if (!assignee) return false
  return assignee.trim().toLowerCase() === memberName.trim().toLowerCase()
}

function isAssignedToMember(
  assignee: string | null,
  memberNames: Set<string>,
): boolean {
  if (!assignee) return false
  return memberNames.has(assignee.trim().toLowerCase())
}

function watchLabel(w: { brand: string | null; model: string | null; name: string; stock_no: string | null }) {
  const title = [w.brand, w.model].filter(Boolean).join(' ') || w.name
  return w.stock_no ? `${title} #${w.stock_no}` : title
}

function buildWatchGroups(
  tasks: Array<{
    id: number
    watch_id: number
    department: string
    task_type: string
    phase: string
    created_at: Date
    watch: {
      id: number
      name: string
      brand: string | null
      model: string | null
      stock_no: string | null
      image_url: string | null
      linked_buy_watch: { image_url: string | null } | null
    }
  }>,
  pipelineEpoch: Date,
): PendingWatchGroup[] {
  const watchMap = new Map<number, PendingWatchGroup>()

  for (const t of tasks) {
    const phase = t.phase === 'SELL' ? 'SELL' : 'BUY'
    if (!watchMap.has(t.watch_id)) {
      watchMap.set(t.watch_id, {
        watch_id: t.watch_id,
        watch_label: watchLabel(t.watch),
        stock_no: t.watch.stock_no,
        phase,
        image_url: t.watch.image_url || t.watch.linked_buy_watch?.image_url || null,
        tasks: [],
      })
    }
    const task: PendingWatchTask = {
      id: t.id,
      task_type: t.task_type,
      label: getTaskLabel(t.task_type, phase),
      department: t.department,
      phase,
      pipeline_started_at: pipelineStartedAtIso(t.created_at, pipelineEpoch),
      is_blocking: isBlockingWatchTask(t.task_type, phase),
    }
    watchMap.get(t.watch_id)!.tasks.push(task)
  }

  return Array.from(watchMap.values())
    .map(g => ({ ...g, tasks: collapseAccessoryPendingTasks(g.tasks) }))
    .sort((a, b) => a.watch_label.localeCompare(b.watch_label))
}

function countDueSoon(
  teamTasks: Array<{ pipeline_started_at: string }>,
  watchGroups: PendingWatchGroup[],
  now: Date,
): number {
  let count = 0
  const tally = (startedAt: string) => {
    if (getPipelineUrgency(new Date(startedAt), now) === 'warning') count++
  }
  for (const t of teamTasks) tally(t.pipeline_started_at)
  for (const g of watchGroups) {
    for (const t of g.tasks) tally(t.pipeline_started_at)
  }
  return count
}

function countOverdue(
  teamTasks: Array<{ pipeline_started_at: string }>,
  watchGroups: PendingWatchGroup[],
  now: Date,
): number {
  let count = 0
  const tally = (startedAt: string) => {
    if (getPipelineUrgency(new Date(startedAt), now) === 'overdue') count++
  }
  for (const t of teamTasks) tally(t.pipeline_started_at)
  for (const g of watchGroups) {
    for (const t of g.tasks) tally(t.pipeline_started_at)
  }
  return count
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req)
    const visibleFilter = await visibleWatchFilter()
    const pipelineEpoch = await getOrInitPipelineTimerEpoch()
    const now = new Date()
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [members, teamTasks, watchTasks, clearedWatch, clearedTeam] = await Promise.all([
      prisma.teamMember.findMany({ orderBy: { name: 'asc' } }),
      prisma.task.findMany({
        where: { is_completed: false },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          message_text: true,
          date: true,
          team_member_id: true,
          assigned_team: true,
          created_at: true,
          assignees: { select: { team_member_id: true } },
        },
      }),
      prisma.watchTask.findMany({
        where: {
          is_completed: false,
          is_locked: false,
          watch: visibleFilter,
        },
        include: {
          watch: {
            select: {
              id: true,
              name: true,
              brand: true,
              model: true,
              stock_no: true,
              image_url: true,
              linked_buy_watch: { select: { image_url: true } },
            },
          },
        },
        orderBy: [{ watch_id: 'asc' }, { id: 'asc' }],
      }),
      prisma.watchTask.count({ where: { completed_at: { gte: since24h } } }),
      prisma.task.count({ where: { is_completed: true, completed_at: { gte: since24h } } }),
    ])

    const memberNames = new Set(members.map(m => m.name.trim().toLowerCase()))
    const unassignedWatchTasks = watchTasks.filter(
      t => !isAssignedToMember(t.assigned_to, memberNames),
    )

    const membersData = members.map(member => {
      const memberTeamTasks = teamTasks
        .filter(t =>
          t.team_member_id === member.id
          || t.assignees.some(a => a.team_member_id === member.id)
        )
        .map(t => ({
          id: t.id,
          message_text: t.message_text,
          date: t.date,
          assigned_team: t.assigned_team,
          created_at: t.created_at.toISOString(),
          pipeline_started_at: pipelineStartedAtIso(t.created_at, pipelineEpoch),
        }))
      const memberWatchTasks = watchTasks.filter(t => nameMatches(t.assigned_to, member.name))
      const watch_groups = buildWatchGroups(memberWatchTasks, pipelineEpoch)
      const pending_count = memberTeamTasks.length + effectiveWatchPendingCount(memberWatchTasks)
      const overdue_count = countOverdue(memberTeamTasks, watch_groups, now)
      const due_soon_count = countDueSoon(memberTeamTasks, watch_groups, now)

      return {
        member: {
          id: member.id,
          name: member.name,
          department: member.department,
          team: member.team ?? null,
        },
        pending_count,
        overdue_count,
        due_soon_count,
        team_tasks: memberTeamTasks,
        watch_groups,
      }
    })

    membersData.sort((a, b) => b.pending_count - a.pending_count || a.member.name.localeCompare(b.member.name))

    const unassignedTeamTasks: typeof membersData[0]['team_tasks'] = []
    const unassignedWatchGroups = buildWatchGroups(unassignedWatchTasks, pipelineEpoch)
    const unassignedPending = unassignedTeamTasks.length + effectiveWatchPendingCount(unassignedWatchTasks)
    const unassignedOverdue = countOverdue(unassignedTeamTasks, unassignedWatchGroups, now)
    const unassignedDueSoon = countDueSoon(unassignedTeamTasks, unassignedWatchGroups, now)

    const unassigned = {
      pending_count: unassignedPending,
      overdue_count: unassignedOverdue,
      due_soon_count: unassignedDueSoon,
      team_tasks: unassignedTeamTasks,
      watch_groups: unassignedWatchGroups,
    }

    const by_department = { ACCOUNTING: 0, SALES: 0, LOGISTICS: 0 }
    let total_pending = 0
    let overdue_count = 0
    let due_soon_count = 0
    const allPipelineItems: Array<{ pipeline_started_at: string }> = []

    for (const m of membersData) {
      total_pending += m.pending_count
      overdue_count += m.overdue_count
      due_soon_count += m.due_soon_count
      for (const t of m.team_tasks) {
        allPipelineItems.push(t)
        by_department[m.member.department as keyof typeof by_department]++
      }
      for (const g of m.watch_groups) {
        for (const t of g.tasks) {
          allPipelineItems.push(t)
          by_department[t.department as keyof typeof by_department]++
        }
      }
    }

    total_pending += unassigned.pending_count
    overdue_count += unassigned.overdue_count
    due_soon_count += unassigned.due_soon_count
    for (const t of unassigned.team_tasks) {
      allPipelineItems.push(t)
    }
    for (const g of unassigned.watch_groups) {
      for (const t of g.tasks) {
        allPipelineItems.push(t)
        by_department[t.department as keyof typeof by_department]++
      }
    }

    const health_score = computeHealthScore(total_pending, overdue_count, unassigned.pending_count)

    let response: PendingDashboardResponse = {
      summary: {
        total_pending,
        overdue_count,
        due_soon_count,
        unassigned_count: unassigned.pending_count,
        cleared_24h: clearedWatch + clearedTeam,
        oldest_overdue_label: maxOverdueLabel(allPipelineItems, now),
        by_department,
        health_score,
        health_label: healthLabel(health_score),
      },
      members: membersData,
      unassigned,
    }

    if (session && !isMaster(session)) {
      const mine = membersData.find(m => namesMatch(m.member.name, session.name))
      const myTeamTasks = mine?.team_tasks ?? []
      const myWatchGroups = mine?.watch_groups ?? []
      const myPending = mine?.pending_count ?? 0
      const myOverdue = mine?.overdue_count ?? 0
      const myDueSoon = mine?.due_soon_count ?? 0
      const myByDept = { ACCOUNTING: 0, SALES: 0, LOGISTICS: 0 }
      const myPipelineItems: Array<{ pipeline_started_at: string }> = []

      for (const t of myTeamTasks) {
        myPipelineItems.push(t)
        if (mine) myByDept[mine.member.department as keyof typeof myByDept]++
      }
      for (const g of myWatchGroups) {
        for (const t of g.tasks) {
          myPipelineItems.push(t)
          myByDept[t.department as keyof typeof myByDept]++
        }
      }

      const myHealth = computeHealthScore(myPending, myOverdue, 0)
      response = {
        summary: {
          total_pending: myPending,
          overdue_count: myOverdue,
          due_soon_count: myDueSoon,
          unassigned_count: 0,
          cleared_24h: clearedWatch + clearedTeam,
          oldest_overdue_label: maxOverdueLabel(myPipelineItems, now),
          by_department: myByDept,
          health_score: myHealth,
          health_label: healthLabel(myHealth),
        },
        members: mine ? [mine] : [],
        unassigned: {
          pending_count: 0,
          overdue_count: 0,
          due_soon_count: 0,
          team_tasks: [],
          watch_groups: [],
        },
      }
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch pending tasks' }, { status: 500 })
  }
}
