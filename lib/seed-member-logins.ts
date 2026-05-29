import { prisma } from '@/lib/prisma'
import { defaultMemberPassword, hashPassword } from '@/lib/auth'

const MASTER_NAMES = new Set(['jhonny', 'johnny'])

export async function seedMemberLogins() {
  const members = await prisma.teamMember.findMany({ orderBy: { id: 'asc' } })
  let jhonnyExists = members.some(m => MASTER_NAMES.has(m.name.toLowerCase()))

  for (const member of members) {
    const isMaster = MASTER_NAMES.has(member.name.toLowerCase())
    const loginUsername = member.login_username?.trim() || member.name.trim()
    const password = defaultMemberPassword(member.name.trim())
    const passwordHash = hashPassword(loginUsername, password)

    await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        login_username: loginUsername,
        password_hash: passwordHash,
        role: isMaster ? 'MASTER' : 'MEMBER',
      },
    })
  }

  if (!jhonnyExists) {
    const loginUsername = 'Jhonny'
    const password = defaultMemberPassword('Jhonny')
    await prisma.teamMember.create({
      data: {
        name: 'Jhonny',
        whatsapp_number: '0000000000',
        department: 'LOGISTICS',
        login_username: loginUsername,
        password_hash: hashPassword(loginUsername, password),
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
