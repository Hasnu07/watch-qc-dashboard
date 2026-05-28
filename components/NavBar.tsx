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
        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all tracking-wide ${
          active
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="sticky top-0 z-50 bg-[#2c313a] border-b border-white/10 shadow-md">
      <div className="flex items-center justify-between px-4 py-3 max-w-screen-2xl mx-auto sm:px-6">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
            W
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-black text-white tracking-tight sm:text-lg">Watch QC</span>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {navLink('/', 'Admin Tasks')}
          {navLink('/dashboard', 'Dashboard')}
          {navLink('/history', 'History')}
          {navLink('/settings', 'Settings')}
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="live-dot w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span className="hidden sm:inline text-slate-400 text-xs font-semibold tracking-widest uppercase">Live</span>
        </div>

      </div>
    </nav>
  )
}
