'use client'

import { useCallback, useState } from 'react'

export type CurrentMember = {
  id: number
  name: string
  loginUsername: string
  role: 'MEMBER' | 'MASTER'
}

function namesMatch(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

// LOGIN REMOVED: every client is treated as the master user. This hook is now
// deterministic (no /api/auth/me fetch), so server and client render identically
// — eliminating the auth-state hydration mismatch that was crashing the app.
const MASTER_MEMBER: CurrentMember = {
  id: 0,
  name: 'Master',
  loginUsername: 'Master',
  role: 'MASTER',
}

export function useCurrentMember() {
  const [member] = useState<CurrentMember | null>(MASTER_MEMBER)
  const [loading] = useState(false)

  const refresh = useCallback(async () => { /* no-op: login removed */ }, [])

  const isMaster = member?.role === 'MASTER'

  const canCompleteWatchTask = useCallback(
    (task: { assigned_to: string | null }) => {
      if (!member) return false
      if (isMaster) return true
      if (!task.assigned_to) return false
      return namesMatch(task.assigned_to, member.name)
    },
    [member, isMaster],
  )

  const canAssignWatchTask = isMaster

  return {
    member,
    loading,
    isMaster,
    canCompleteWatchTask,
    canAssignWatchTask,
    refresh,
  }
}
