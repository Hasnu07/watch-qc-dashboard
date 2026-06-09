import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { MemberRole } from '@prisma/client'

export const SESSION_COOKIE = 'qc_member_session'
const SESSION_DAYS = 7

export type SessionMember = {
  id: number
  name: string
  loginUsername: string
  role: MemberRole
}

export function hashPassword(username: string, password: string) {
  return crypto.createHash('sha256').update(`${username}:${password}:qc-salt`).digest('hex')
}

export function defaultMemberPassword(name: string) {
  return `${name}@125`
}

export function namesMatch(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Prisma where fragment: MEMBER sees only tasks assigned to them; MASTER sees all. */
export function watchTaskAssigneeFilter(member: SessionMember) {
  if (isMaster(member)) return {}
  return {
    assigned_to: { equals: member.name.trim(), mode: 'insensitive' as const },
  }
}

export async function createSession(memberId: number) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await prisma.memberSession.create({
    data: { token, team_member_id: memberId, expires_at: expiresAt },
  })
  return { token, expiresAt }
}

export async function destroySession(token: string | undefined) {
  if (!token) return
  await prisma.memberSession.deleteMany({ where: { token } }).catch(() => {})
}

export async function getSessionMember(token: string | undefined): Promise<SessionMember | null> {
  if (!token) return null
  const row = await prisma.memberSession.findUnique({
    where: { token },
    include: { team_member: true },
  })
  if (!row || row.expires_at < new Date()) {
    if (row) await prisma.memberSession.deleteMany({ where: { token } }).catch(() => {})
    return null
  }
  const m = row.team_member
  return {
    id: m.id,
    name: m.name,
    loginUsername: m.login_username ?? m.name,
    role: m.role,
  }
}

export function getSessionToken(req: NextRequest): string | undefined {
  return req.cookies.get(SESSION_COOKIE)?.value
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionMember | null> {
  return getSessionMember(getSessionToken(req))
}

export async function requireSession(req: NextRequest): Promise<SessionMember | NextResponse> {
  const member = await getSessionFromRequest(req)
  if (!member) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return member
}

export function requireMaster(member: SessionMember): NextResponse | null {
  if (member.role !== 'MASTER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export function isMaster(member: SessionMember) {
  return member.role === 'MASTER'
}

export function canCompleteWatchTask(
  member: SessionMember,
  task: { assigned_to: string | null },
) {
  if (isMaster(member)) return true
  if (!task.assigned_to) return false
  return namesMatch(task.assigned_to, member.name)
}

export function canAssignWatchTask(member: SessionMember) {
  return isMaster(member)
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' })
}
