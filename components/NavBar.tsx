'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSseStatus } from '@/components/SseProvider'
import { useUiSounds } from '@/components/SoundProvider'
import { useCurrentMember } from '@/hooks/useCurrentMember'

const NAV = [
  { href: '/', label: 'Team' },
  { href: '/dashboard', label: 'Pipeline' },
  { href: '/pending', label: 'Pending' },
  { href: '/slideshow', label: 'Task Slideshow' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings', masterOnly: true },
] as const

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { connected } = useSseStatus()
  const { enabled, toggle } = useUiSounds()
  const { member, isMaster, loading } = useCurrentMember()

  const visibleNav = NAV.filter(item => !('masterOnly' in item && item.masterOnly) || isMaster)

  if (pathname === '/slideshow') return null

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
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
