'use client'

import { useEffect } from 'react'

interface Shortcuts {
  onSearch?: () => void
  onNewWatch?: () => void
}

export function useKeyboardShortcuts({ onSearch, onNewWatch }: Shortcuts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '/' && onSearch) {
        e.preventDefault()
        onSearch()
      }
      if (e.key === 'n' && onNewWatch) {
        e.preventDefault()
        onNewWatch()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSearch, onNewWatch])
}
