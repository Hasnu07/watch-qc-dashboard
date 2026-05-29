'use client'

import { useState, useEffect, useCallback } from 'react'

export type WatchTaskSortMode = 'new' | 'pending' | 'name'

export type RolePreset = { name: string; department: 'LOGISTICS' | 'ACCOUNTING' | 'SALES' }

export const ROLE_PRESETS: RolePreset[] = [
  { name: 'Haris', department: 'LOGISTICS' },
  { name: 'Hassan', department: 'ACCOUNTING' },
  { name: 'Aleena', department: 'SALES' },
]

export function useWatchTaskFilters() {
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [myName, setMyName] = useState('')
  const [sort, setSort] = useState<WatchTaskSortMode>('new')
  const [deptFilter, setDeptFilter] = useState<string | null>(null)

  useEffect(() => {
    setMyName(localStorage.getItem('qc_my_name') || '')
    setMyTasksOnly(localStorage.getItem('qc_my_tasks_filter') === '1')
    setDeptFilter(localStorage.getItem('qc_task_dept_filter') || null)
  }, [])

  const setMyTasksOnlyPersist = useCallback((value: boolean) => {
    setMyTasksOnly(value)
    localStorage.setItem('qc_my_tasks_filter', value ? '1' : '0')
  }, [])

  const setMyNamePersist = useCallback((name: string) => {
    setMyName(name)
    localStorage.setItem('qc_my_name', name)
  }, [])

  const setDeptFilterPersist = useCallback((dept: string | null) => {
    setDeptFilter(dept)
    if (dept) localStorage.setItem('qc_task_dept_filter', dept)
    else localStorage.removeItem('qc_task_dept_filter')
  }, [])

  const clearMyTasksFilter = useCallback(() => {
    setMyTasksOnlyPersist(false)
    setDeptFilterPersist(null)
  }, [setMyTasksOnlyPersist, setDeptFilterPersist])

  const applyRolePreset = useCallback((preset: RolePreset) => {
    setMyNamePersist(preset.name)
    setMyTasksOnlyPersist(true)
    setDeptFilterPersist(preset.department)
  }, [setMyNamePersist, setMyTasksOnlyPersist, setDeptFilterPersist])

  const filterByAssignee = useCallback(<T extends { assigned_to: string | null; department: string }>(tasks: T[]) => {
    let result = tasks
    if (deptFilter) result = result.filter(t => t.department === deptFilter)
    if (myTasksOnly && myName) result = result.filter(t => t.assigned_to === myName)
    return result
  }, [myTasksOnly, myName, deptFilter])

  return {
    myTasksOnly,
    setMyTasksOnly: setMyTasksOnlyPersist,
    myName,
    setMyName: setMyNamePersist,
    sort,
    setSort,
    deptFilter,
    setDeptFilter: setDeptFilterPersist,
    applyRolePreset,
    filterByAssignee,
    clearMyTasksFilter,
  }
}
