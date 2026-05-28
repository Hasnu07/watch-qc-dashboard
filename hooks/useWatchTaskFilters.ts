'use client'

import { useState, useEffect, useCallback } from 'react'

export type WatchTaskSortMode = 'new' | 'pending' | 'name'

export function useWatchTaskFilters() {
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [myName, setMyName] = useState('')
  const [sort, setSort] = useState<WatchTaskSortMode>('new')

  useEffect(() => {
    setMyName(localStorage.getItem('qc_my_name') || '')
    setMyTasksOnly(localStorage.getItem('qc_my_tasks_filter') === '1')
  }, [])

  const setMyTasksOnlyPersist = useCallback((value: boolean) => {
    setMyTasksOnly(value)
    localStorage.setItem('qc_my_tasks_filter', value ? '1' : '0')
  }, [])

  const setMyNamePersist = useCallback((name: string) => {
    setMyName(name)
    localStorage.setItem('qc_my_name', name)
  }, [])

  const clearMyTasksFilter = useCallback(() => {
    setMyTasksOnlyPersist(false)
  }, [setMyTasksOnlyPersist])

  const filterByAssignee = useCallback(<T extends { assigned_to: string | null }>(tasks: T[]) => {
    if (!myTasksOnly || !myName) return tasks
    return tasks.filter(t => t.assigned_to === myName)
  }, [myTasksOnly, myName])

  return {
    myTasksOnly,
    setMyTasksOnly: setMyTasksOnlyPersist,
    myName,
    setMyName: setMyNamePersist,
    sort,
    setSort,
    filterByAssignee,
    clearMyTasksFilter,
  }
}
