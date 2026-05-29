'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { detectClickSound, playUiSound, type UiSound } from '@/lib/ui-sounds'

const STORAGE_KEY = 'qc_sounds_enabled'

type SoundContextValue = {
  enabled: boolean
  setEnabled: (value: boolean) => void
  toggle: () => void
  play: (sound: UiSound) => void
}

const SoundContext = createContext<SoundContextValue>({
  enabled: true,
  setEnabled: () => {},
  toggle: () => {},
  play: () => {},
})

export function useUiSounds() {
  return useContext(SoundContext)
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setEnabledState(stored !== '0')
    setHydrated(true)
  }, [])

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value)
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  }, [])

  const toggle = useCallback(() => {
    setEnabledState(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      if (next) playUiSound('pop')
      return next
    })
  }, [])

  const play = useCallback(
    (sound: UiSound) => {
      if (!enabled) return
      playUiSound(sound)
    },
    [enabled],
  )

  useEffect(() => {
    if (!hydrated || !enabled) return

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      const sound = detectClickSound(event.target)
      if (sound) playUiSound(sound)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [enabled, hydrated])

  const value = useMemo(
    () => ({ enabled, setEnabled, toggle, play }),
    [enabled, setEnabled, toggle, play],
  )

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}
