'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getProfileAvatarHoverFallbacks, getProfileAvatarUrl } from '@/lib/profile-avatars'

interface LoginProfile {
  id: number
  name: string
  department: string
  role: string
  login_username: string | null
  avatar_url?: string | null
}

const PROFILE_COLORS = [
  'linear-gradient(145deg, #e50914 0%, #831010 100%)',
  'linear-gradient(145deg, #0080ff 0%, #004999 100%)',
  'linear-gradient(145deg, #46d369 0%, #1e7a34 100%)',
  'linear-gradient(145deg, #ff9f0a 0%, #c67600 100%)',
  'linear-gradient(145deg, #bf5af2 0%, #7a2eb8 100%)',
  'linear-gradient(145deg, #00c7be 0%, #007a75 100%)',
  'linear-gradient(145deg, #ff375f 0%, #b81845 100%)',
  'linear-gradient(145deg, #ffd60a 0%, #b89200 100%)',
  'linear-gradient(145deg, #64d2ff 0%, #0077b6 100%)',
  'linear-gradient(145deg, #ac8e68 0%, #6b5344 100%)',
]

function profileColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PROFILE_COLORS[Math.abs(hash) % PROFILE_COLORS.length]
}

function ProfileSmiley({ large }: { large?: boolean }) {
  return (
    <svg
      className={large ? 'netflix-profile__smiley netflix-profile__smiley--large' : 'netflix-profile__smiley'}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <circle cx="22" cy="26" r="4" fill="currentColor" />
      <circle cx="42" cy="26" r="4" fill="currentColor" />
      <path
        d="M18 38 Q32 52 46 38"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function profileAvatarSrc(profile: { name: string; avatar_url?: string | null }) {
  return profile.avatar_url ?? getProfileAvatarUrl(profile.name)
}

function ProfileAvatar({
  name,
  role,
  avatarUrl,
  large,
  hoverable = true,
  isHovered = false,
}: {
  name: string
  role: string
  avatarUrl: string | null
  large?: boolean
  hoverable?: boolean
  isHovered?: boolean
}) {
  const [staticFailed, setStaticFailed] = useState(false)
  const [hoverSrc, setHoverSrc] = useState<string | null>(null)
  const hoverRef = useRef<HTMLImageElement>(null)

  const hoverFallbacks = useMemo(() => getProfileAvatarHoverFallbacks(name), [name])
  const hasHover = hoverable && hoverFallbacks.length > 0

  useEffect(() => {
    if (!hasHover) return
    let cancelled = false
    const tryNext = (index: number) => {
      if (cancelled || index >= hoverFallbacks.length) return
      const img = new window.Image()
      img.onload = () => {
        if (!cancelled) setHoverSrc(hoverFallbacks[index])
      }
      img.onerror = () => tryNext(index + 1)
      img.src = hoverFallbacks[index]
    }
    tryNext(0)
    return () => { cancelled = true }
  }, [hasHover, hoverFallbacks])

  useEffect(() => {
    if (!isHovered || !hoverRef.current || !hoverSrc) return
    const base = hoverSrc.split('?')[0]
    hoverRef.current.src = `${base}?t=${Date.now()}`
  }, [isHovered, hoverSrc])

  const showStatic = Boolean(avatarUrl) && !staticFailed
  const showHover = Boolean(hoverSrc) && isHovered

  return (
    <div
      className={[
        large ? 'netflix-profile__avatar netflix-profile__avatar--large' : 'netflix-profile__avatar',
        hasHover && hoverSrc ? 'netflix-profile__avatar--has-hover' : '',
      ].filter(Boolean).join(' ')}
      style={showStatic || showHover ? undefined : { background: profileColor(name) }}
    >
      {showStatic && avatarUrl && (
        <img
          src={avatarUrl}
          alt=""
          className={`netflix-profile__avatar-img netflix-profile__avatar-static${showHover ? ' netflix-profile__avatar-static--hidden' : ''}`}
          onError={() => setStaticFailed(true)}
        />
      )}
      {hasHover && hoverSrc && (
        <img
          ref={hoverRef}
          src={hoverSrc}
          alt=""
          className={`netflix-profile__avatar-img netflix-profile__avatar-hover${showHover ? ' netflix-profile__avatar-hover--visible' : ''}`}
        />
      )}
      {!showStatic && !showHover && <ProfileSmiley large={large} />}
      {role === 'MASTER' && (
        <span className="netflix-profile__badge" title="Master">
          ★
        </span>
      )}
    </div>
  )
}

function ProfilePickButton({
  profile,
  onPick,
}: {
  profile: LoginProfile
  onPick: (profile: LoginProfile) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      className="netflix-profile group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPick(profile)}
    >
      <ProfileAvatar
        name={profile.name}
        role={profile.role}
        avatarUrl={profileAvatarSrc(profile)}
        isHovered={hovered}
      />
      <span className="netflix-profile__name">{profile.name}</span>
    </button>
  )
}

function redirectAfterLogin() {
  const params = new URLSearchParams(window.location.search)
  const next = params.get('next')
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  window.location.href = safeNext
}

export default function LoginPage() {
  const [profiles, setProfiles] = useState<LoginProfile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [selected, setSelected] = useState<LoginProfile | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    fetch('/api/auth/profiles')
      .then(r => r.ok ? r.json() : [])
      .then(data => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => setProfiles([]))
      .finally(() => setLoadingProfiles(false))
  }, [])

  const pickProfile = (profile: LoginProfile) => {
    setSelected(profile)
    setPassword('')
    setError('')
    setShowPassword(false)
  }

  const backToProfiles = () => {
    setSelected(null)
    setPassword('')
    setError('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setError('')
    setLoading(true)
    try {
      const username = selected.login_username?.trim() || selected.name.trim()
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        redirectAfterLogin()
        return
      }
      setError(typeof data.error === 'string' ? data.error : 'Incorrect password')
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="netflix-login">
      <div className="netflix-login__logo">
        <Image
          src="/purosangue-qc-logo.png"
          alt="Purosangue QC"
          width={72}
          height={72}
          className="netflix-login__logo-img"
          priority
        />
      </div>

      {!selected ? (
        <div className="netflix-login__pick">
          <h1 className="netflix-login__title">Who&apos;s working?</h1>
          <p className="netflix-login__subtitle">Select your profile to continue</p>

          {loadingProfiles ? (
            <div className="netflix-login__grid">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="netflix-profile netflix-profile--skeleton">
                  <div className="netflix-profile__avatar" />
                  <div className="netflix-profile__name-skeleton" />
                </div>
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <p className="netflix-login__error">Could not load team profiles. Refresh the page.</p>
          ) : (
            <div className="netflix-login__grid">
              {profiles.map(profile => (
                <ProfilePickButton key={profile.id} profile={profile} onPick={pickProfile} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="netflix-login__password-step">
          <button type="button" className="netflix-login__back" onClick={backToProfiles}>
            ← Profiles
          </button>

          <ProfileAvatar
            name={selected.name}
            role={selected.role}
            avatarUrl={profileAvatarSrc(selected)}
            large
          />

          <h2 className="netflix-login__profile-name">{selected.name}</h2>
          <p className="netflix-login__subtitle">Enter your password</p>

          <form onSubmit={handleLogin} className="netflix-login__form">
            <div className="netflix-login__password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="netflix-login__password-input"
                autoFocus
                required
              />
              <button
                type="button"
                className="netflix-login__eye"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>

            {error && <p className="netflix-login__error">{error}</p>}

            <button type="submit" disabled={loading} className="netflix-login__submit">
              {loading ? 'Signing in…' : 'Continue'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
