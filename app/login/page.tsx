'use client'

import { useEffect } from 'react'

// LOGIN REMOVED: this route no longer shows a login screen. Anyone who lands
// here (old bookmark, NavBar sign-out, etc.) is sent straight to the dashboard.
export default function LoginPage() {
  useEffect(() => {
    window.location.replace('/dashboard')
  }, [])

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <p className="text-muted text-sm">Loading…</p>
    </div>
  )
}
