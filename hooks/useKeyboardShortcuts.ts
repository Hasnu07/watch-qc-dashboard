'use client'

import { useEffect } from 'react'

interface Shortcuts {
  onSearch?: () => void
  onNewWatch?: () => void
  onCommandPalette?: () => void
}

export function useKeyboardShortcuts(handlers: Shortcuts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handlers.onCommandPalette?.()
        return
      }
      if (e.key === '/' && handlers.onSearch) {
        e.preventDefault()
        handlers.onSearch()
      }
      if (e.key === 'n' && handlers.onNewWatch) {
        e.preventDefault()
        handlers.onNewWatch()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlers])
}
