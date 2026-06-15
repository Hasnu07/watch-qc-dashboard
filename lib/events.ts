import { EventEmitter } from 'events'

class DashboardEvents extends EventEmitter {}

const globalForEvents = globalThis as unknown as {
  dashboardEvents: DashboardEvents | undefined
}

export const dashboardEvents =
  globalForEvents.dashboardEvents ?? new DashboardEvents()

if (!globalForEvents.dashboardEvents) {
  dashboardEvents.setMaxListeners(200)
  globalForEvents.dashboardEvents = dashboardEvents
}

export type TaskEventPayload = {
  type: 'new_task' | 'task_updated'
  task: {
    id: number
    team_member_id: number | null
    assigned_team: string | null
    message_text: string
    date: string
    estimated_minutes: number | null
    created_at: string
    team_member: { id: number; name: string; whatsapp_number: string; department: string } | null
    assignees?: Array<{ team_member: { id: number; name: string; whatsapp_number: string; department: string } }>
  }
}

export type WatchEventPayload = {
  type: 'watch_sold' | 'new_watch' | 'watch_updated'
  watchId: number
}

export function emitTaskEvent(payload: TaskEventPayload) {
  dashboardEvents.emit('dashboard', payload)
}

export function emitWatchEvent(payload: WatchEventPayload) {
  dashboardEvents.emit('dashboard', payload)
}

export type WatchTaskEventPayload = {
  type: 'task_completed' | 'task_unlocked' | 'task_updated'
  watch_task_id: number
  watch_id: number
  department?: string
  task_type?: string
  metadata?: Record<string, unknown>
}

export function emitWatchTaskEvent(payload: WatchTaskEventPayload) {
  dashboardEvents.emit('dashboard', payload)
}
