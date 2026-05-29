'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

export type WatchTaskSortMode = 'new' | 'pending' | 'name'

export type RolePreset = { name: string; department: 'LOGISTICS' | 'ACCOUNTING' | 'SALES' }

export const ROLE_PRESETS: RolePreset[] = [
  { name: 'Haris', department: 'LOGISTICS' },
  { name: 'Hassan', department: 'ACCOUNTING' },
  { name: 'Aleena', department: 'SALES' },
]

function namesMatch(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

type WatchTaskFilterOptions = {
  /** When set, user is locked to their own tasks (non-master members). */
  restrictToMember?: string | null
}

export function useWatchTaskFilters(options?: WatchTaskFilterOptions) {
  const restrictToMember = options?.restrictToMember ?? null
  const memberOnly = !!restrictToMember

  const [myTasksOnly, setMyTasksOnly] = useState(memberOnly)
  const [myName, setMyName] = useState(restrictToMember ?? '')
  const [sort, setSort] = useState<WatchTaskSortMode>('new')
  const [deptFilter, setDeptFilter] = useState<string | null>(null)

  useEffect(() => {
    if (memberOnly) {
      setMyTasksOnly(true)
      setMyName(restrictToMember!)
      return
    }
    setMyName(localStorage.getItem('qc_my_name') || '')
    setMyTasksOnly(localStorage.getItem('qc_my_tasks_filter') === '1')
    setDeptFilter(localStorage.getItem('qc_task_dept_filter') || null)
  }, [memberOnly, restrictToMember])

  const setMyTasksOnlyPersist = useCallback((value: boolean) => {
    if (memberOnly) return
    setMyTasksOnly(value)
    localStorage.setItem('qc_my_tasks_filter', value ? '1' : '0')
  }, [memberOnly])

  const setMyNamePersist = useCallback((name: string) => {
    if (memberOnly) return
    setMyName(name)
    localStorage.setItem('qc_my_name', name)
  }, [memberOnly])

  const setDeptFilterPersist = useCallback((dept: string | null) => {
    if (memberOnly) return
    setDeptFilter(dept)
    if (dept) localStorage.setItem('qc_task_dept_filter', dept)
    else localStorage.removeItem('qc_task_dept_filter')
  }, [memberOnly])

  const clearMyTasksFilter = useCallback(() => {
    if (memberOnly) return
    setMyTasksOnlyPersist(false)
    setDeptFilterPersist(null)
  }, [memberOnly, setMyTasksOnlyPersist, setDeptFilterPersist])

  const applyRolePreset = useCallback((preset: RolePreset) => {
    if (memberOnly) return
    setMyNamePersist(preset.name)
    setMyTasksOnlyPersist(true)
    setDeptFilterPersist(preset.department)
  }, [memberOnly, setMyNamePersist, setMyTasksOnlyPersist, setDeptFilterPersist])

  const filterByAssignee = useCallback(<T extends { assigned_to: string | null; department: string }>(tasks: T[]) => {
    let result = tasks
    if (deptFilter) result = result.filter(t => t.department === deptFilter)
    const effectiveMyTasksOnly = memberOnly || myTasksOnly
    const effectiveName = memberOnly ? restrictToMember : myName
    if (effectiveMyTasksOnly && effectiveName) {
      result = result.filter(t => namesMatch(t.assigned_to, effectiveName))
    }
    return result
  }, [memberOnly, myTasksOnly, myName, restrictToMember, deptFilter])

  const filtersActive = useMemo(
    () => memberOnly || myTasksOnly || !!deptFilter,
    [memberOnly, myTasksOnly, deptFilter],
  )

  return {
    myTasksOnly: memberOnly || myTasksOnly,
    setMyTasksOnly: setMyTasksOnlyPersist,
    myName: memberOnly ? restrictToMember! : myName,
    setMyName: setMyNamePersist,
    sort,
    setSort,
    deptFilter,
    setDeptFilter: setDeptFilterPersist,
    applyRolePreset,
    filterByAssignee,
    clearMyTasksFilter,
    memberOnly,
    filtersActive,
  }
}
