'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSseStatus } from '@/components/SseProvider'
import { useUiSounds } from '@/components/SoundProvider'
import { useCurrentMember } from '@/hooks/useCurrentMember'

const NAV = [
  { href: '/', label: 'Team' },
  { href: '/dashboard', label: 'Pipeline' },
  { href: '/pending', label: 'Pending' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings', masterOnly: true },
] as const

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { connected } = useSseStatus()
  const { enabled, toggle } = useUiSounds()
  const { member, isMaster, loading } = useCurrentMember()
  const [waAutoSend, setWaAutoSend] = useState<'1' | '0'>('1')
  const [waSaving, setWaSaving] = useState(false)

  const visibleNav = NAV.filter(item => !('masterOnly' in item && item.masterOnly) || isMaster)

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    if (!isMaster) return
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const v = data?.whatsapp_auto_send
        setWaAutoSend(v === '0' ? '0' : '1')
      })
      .catch(() => {})
  }, [isMaster])

  // Early return AFTER all hooks — returning before a hook violates the Rules
  // of Hooks and crashes React when navigating to/from /login.
  if (pathname === '/login') return null

  const toggleWhatsAppAutoSend = async () => {
    if (!isMaster || waSaving) return
    const next: '1' | '0' = waAutoSend === '1' ? '0' : '1'
    setWaAutoSend(next)
    setWaSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_auto_send: next }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setWaAutoSend(next === '1' ? '0' : '1')
    } finally {
      setWaSaving(false)
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-panel border-b border-default">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="font-semibold text-sm text-ink shrink-0">
          Purosangue QC
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          {visibleNav.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-card text-ink' : 'text-muted hover:text-ink hover:bg-card/60'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          {!loading && isMaster && (
            <button
              type="button"
              onClick={toggleWhatsAppAutoSend}
              disabled={waSaving}
              className={`text-xs px-2.5 py-1 rounded-md border ${
                waAutoSend === '1'
                  ? 'border-accent/40 text-accent bg-accent/10'
                  : 'border-default text-muted bg-panel'
              } disabled:opacity-60`}
              title="Toggle WhatsApp auto-send"
            >
              {waAutoSend === '1' ? 'WA ON' : 'WA OFF'}
            </button>
          )}
          {!loading && member && pathname !== '/login' && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted">
              <span className="text-ink font-medium">{member.name}</span>
              {isMaster && (
                <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent font-semibold">Master</span>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="text-muted hover:text-ink underline-offset-2 hover:underline"
              >
                Sign out
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            className="sound-toggle-btn"
            title={enabled ? 'Mute UI sounds' : 'Enable UI sounds'}
            aria-label={enabled ? 'Mute UI sounds' : 'Enable UI sounds'}
            aria-pressed={enabled}
          >
            {enabled ? '🔊' : '🔇'}
          </button>
          <span className={`hidden sm:inline text-xs ${connected ? 'text-positive' : 'text-muted'}`}>
            {connected ? 'Live' : 'Offline'}
          </span>
          <div className="sm:hidden flex gap-0.5 overflow-x-auto">
            {visibleNav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-2 py-1 text-xs rounded whitespace-nowrap ${pathname === href ? 'text-accent' : 'text-muted'}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
