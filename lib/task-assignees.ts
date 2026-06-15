import type { Department } from '@prisma/client'

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
  assignees?: Array<{ team_member: TaskMember }>
}

export function resolveTaskAssignees(task: TaskWithAssignees): TaskMember[] {
  if (task.assignees?.length) {
    return task.assignees.map(a => a.team_member)
  }
  if (task.team_member) return [task.team_member]
  return []
}

export const TASK_INCLUDE = {
  team_member: true,
  assigned_by: true,
  assignees: { include: { team_member: true }, orderBy: { id: 'asc' as const } },
}
