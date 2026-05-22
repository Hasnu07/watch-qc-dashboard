'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavBar() {
  const pathname = usePathname()

  const navLink = (href: string, label: string) => {
    const active = pathname === href
    return (
      <Link
        href={href}
        className={`px-5 py-2 rounded-lg text-lg font-semibold transition-colors ${
          active
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="flex items-center justify-between px-8 py-4 bg-[#111118] border-b border-white/10 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
          W
        </div>
        <span className="text-xl font-bold text-white tracking-wide">
          Watch QC
        </span>
      </div>

      <div className="flex items-center gap-2">
        {navLink('/', 'Dashboard')}
        {navLink('/history', 'History')}
        {navLink('/settings', 'Settings')}
      </div>

      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <span className="live-dot w-2 h-2 rounded-full bg-green-400 inline-block" />
        <span>Live</span>
      </div>
    </nav>
  )
}
