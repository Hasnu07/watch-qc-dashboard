'use client'

import { useCallback, useEffect, useState } from 'react'

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

export function useCurrentMember() {
  const [member, setMember] = useState<CurrentMember | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        setMember(await res.json())
      } else {
        setMember(null)
      }
    } catch {
      setMember(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

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
