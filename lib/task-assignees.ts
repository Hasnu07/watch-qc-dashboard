import type { Department } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type TaskMember = {
  id: number
  name: string
  whatsapp_number: string
  department: Department
  team?: string | null
}

export type TaskWithAssignees = {
  team_member_id: number | null
  team_member: TaskMember | null
  assigned_team: string | null
  assignee_ids?: number[]
  assignees?: Array<{ team_member: TaskMember }>
}

export const TASK_INCLUDE = {
  team_member: true,
  assigned_by: true,
}

export function resolveAssigneeIds(task: {
  assignee_ids?: number[]
  team_member_id: number | null
}): number[] {
  if (task.assignee_ids?.length) return task.assignee_ids
  if (task.team_member_id) return [task.team_member_id]
  return []
}

export function resolveTaskAssignees(task: TaskWithAssignees): TaskMember[] {
  if (task.assignees?.length) {
    return task.assignees.map(a => a.team_member).filter(Boolean)
  }
  if (task.team_member) return [task.team_member]
  return []
}

export type EnrichedTask<T> = T & {
  assignees: Array<{ team_member: TaskMember }>
}

export async function enrichTasksWithAssignees<T extends {
  team_member_id: number | null
  team_member: TaskMember | null
  assignee_ids?: number[]
}>(tasks: T[]): Promise<EnrichedTask<T>[]> {
  const allIds = new Set<number>()
  for (const task of tasks) {
    for (const id of resolveAssigneeIds(task)) allIds.add(id)
  }

  const members = allIds.size
    ? await prisma.teamMember.findMany({ where: { id: { in: Array.from(allIds) } } })
    : []
  const byId = new Map(members.map(m => [m.id, m as TaskMember]))

  return tasks.map(task => {
    const assignees = resolveAssigneeIds(task)
      .map(id => {
        const team_member = byId.get(id)
        return team_member ? { team_member } : null
      })
      .filter((entry): entry is { team_member: TaskMember } => entry !== null)

    return {
      ...task,
      assignees,
    }
  })
}
