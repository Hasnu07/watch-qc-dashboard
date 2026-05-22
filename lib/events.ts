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
    team_member_id: number
    message_text: string
    date: string
    estimated_minutes: number | null
    created_at: string
    team_member: { id: number; name: string; whatsapp_number: string; department: string }
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
