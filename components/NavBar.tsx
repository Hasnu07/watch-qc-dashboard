'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSseStatus } from '@/components/SseProvider'

const NAV = [
  { href: '/', label: 'Team' },
  { href: '/dashboard', label: 'Pipeline' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
] as const

export default function NavBar() {
  const pathname = usePathname()
  const { connected } = useSseStatus()

  return (
    <nav className="sticky top-0 z-50 bg-panel border-b border-default">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="font-semibold text-sm text-ink shrink-0">
          Purosangue QC
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          {NAV.map(({ href, label }) => {
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
          <span className={`hidden sm:inline text-xs ${connected ? 'text-positive' : 'text-muted'}`}>
            {connected ? 'Live' : 'Offline'}
          </span>
          <div className="sm:hidden flex gap-0.5">
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href}
                className={`px-2 py-1 text-xs rounded ${pathname === href ? 'text-accent' : 'text-muted'}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
