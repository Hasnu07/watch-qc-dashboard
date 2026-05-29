import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { visibleWatchFilter } from '@/lib/watch-visibility'
import { getTaskLabel } from '@/lib/task-labels'
import { getOrInitPipelineTimerEpoch, pipelineStartedAtIso } from '@/lib/pipeline-timer-server'

export const dynamic = 'force-dynamic'

function nameMatches(assignee: string | null, memberName: string): boolean {
  if (!assignee) return false
  return assignee.trim().toLowerCase() === memberName.trim().toLowerCase()
}

function watchLabel(w: { brand: string | null; model: string | null; name: string; stock_no: string | null }) {
  const title = [w.brand, w.model].filter(Boolean).join(' ') || w.name
  return w.stock_no ? `${title} #${w.stock_no}` : title
}

export async function GET() {
  try {
    const visibleFilter = await visibleWatchFilter()
    const pipelineEpoch = await getOrInitPipelineTimerEpoch()

    const [members, teamTasks, watchTasks] = await Promise.all([
      prisma.teamMember.findMany({ orderBy: { name: 'asc' } }),
      prisma.task.findMany({
        where: { is_completed: false },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          message_text: true,
          date: true,
          team_member_id: true,
          created_at: true,
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
              watch_type: true,
            },
          },
        },
        orderBy: [{ watch_id: 'asc' }, { id: 'asc' }],
      }),
    ])

    const membersData = members.map(member => {
      const memberTeamTasks = teamTasks.filter(t => t.team_member_id === member.id)
      const memberWatchTasks = watchTasks.filter(t => nameMatches(t.assigned_to, member.name))

      const watchMap = new Map<number, {
        watch_id: number
        watch_label: string
        phase: string
        tasks: Array<{
          id: number
          task_type: string
          label: string
          department: string
          phase: string
          pipeline_started_at: string
        }>
      }>()

      for (const t of memberWatchTasks) {
        const phase = t.phase === 'SELL' ? 'SELL' : 'BUY'
        if (!watchMap.has(t.watch_id)) {
          watchMap.set(t.watch_id, {
            watch_id: t.watch_id,
            watch_label: watchLabel(t.watch),
            phase,
            tasks: [],
          })
        }
        watchMap.get(t.watch_id)!.tasks.push({
          id: t.id,
          task_type: t.task_type,
          label: getTaskLabel(t.task_type, phase),
          department: t.department,
          phase,
          pipeline_started_at: pipelineStartedAtIso(t.created_at, pipelineEpoch),
        })
      }

      const watch_groups = Array.from(watchMap.values()).sort((a, b) =>
        a.watch_label.localeCompare(b.watch_label),
      )

      const pending_count = memberTeamTasks.length + memberWatchTasks.length

      return {
        member: {
          id: member.id,
          name: member.name,
          department: member.department,
        },
        pending_count,
        team_tasks: memberTeamTasks.map(t => ({
          ...t,
          pipeline_started_at: pipelineStartedAtIso(t.created_at, pipelineEpoch),
        })),
        watch_groups,
      }
    })

    membersData.sort((a, b) => b.pending_count - a.pending_count || a.member.name.localeCompare(b.member.name))

    return NextResponse.json(membersData)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch pending tasks' }, { status: 500 })
  }
}
