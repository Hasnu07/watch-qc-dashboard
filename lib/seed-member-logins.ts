import { prisma } from '@/lib/prisma'
import { defaultMemberPassword, hashPassword } from '@/lib/auth'

const MASTER_LOGIN = 'Master'
const LEGACY_MASTER_NAMES = new Set(['jhonny', 'johnny'])

function isLegacyMaster(member: { name: string; login_username: string | null; role: string }) {
  const name = member.name.trim().toLowerCase()
  const login = (member.login_username || '').trim().toLowerCase()
  return member.role === 'MASTER' || LEGACY_MASTER_NAMES.has(name) || LEGACY_MASTER_NAMES.has(login)
}

export async function seedMemberLogins() {
  const members = await prisma.teamMember.findMany({ orderBy: { id: 'asc' } })
  let masterExists = false
  const masterPassword = defaultMemberPassword(MASTER_LOGIN)
  const masterPasswordHash = hashPassword(MASTER_LOGIN, masterPassword)

  for (const member of members) {
    if (isLegacyMaster(member)) {
      masterExists = true
      await prisma.teamMember.update({
        where: { id: member.id },
        data: {
          name: MASTER_LOGIN,
          login_username: MASTER_LOGIN,
          password_hash: masterPasswordHash,
          role: 'MASTER',
        },
      })
      continue
    }

    const loginUsername = member.login_username?.trim() || member.name.trim()
    const password = defaultMemberPassword(member.name.trim())
    await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        login_username: loginUsername,
        password_hash: hashPassword(loginUsername, password),
        role: 'MEMBER',
      },
    })
  }

  if (!masterExists) {
    await prisma.teamMember.create({
      data: {
        name: MASTER_LOGIN,
        whatsapp_number: '0000000000',
        department: 'LOGISTICS',
        login_username: MASTER_LOGIN,
        password_hash: masterPasswordHash,
        role: 'MASTER',
      },
    })
  }

  await prisma.setting.deleteMany({
    where: { key: { in: ['admin_session_token', 'admin_username', 'admin_password_hash'] } },
  }).catch(() => {})
}

export function verifyMemberPassword(
  member: { name: string; login_username: string | null; password_hash: string | null },
  password: string,
) {
  if (!member.password_hash) return false
  const candidates: string[] = []
  if (member.login_username?.trim()) candidates.push(member.login_username.trim())
  if (member.name.trim()) candidates.push(member.name.trim())
  for (const key of candidates) {
    if (hashPassword(key, password) === member.password_hash) return true
  }
  return false
}
