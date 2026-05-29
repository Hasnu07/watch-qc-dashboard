// Seed login_username + password_hash for all team members.
// Password pattern: {name}@125  (e.g. Aleena / Aleena@125)
// Jhonny (case-insensitive) gets MASTER role.
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const MASTER_NAMES = ['jhonny', 'johnny']

function hashPassword(username, password) {
  return crypto.createHash('sha256').update(`${username}:${password}:qc-salt`).digest('hex')
}

function memberPassword(name) {
  return `${name}@125`
}

async function main() {
  const members = await prisma.teamMember.findMany({ orderBy: { id: 'asc' } })
  let jhonnyExists = members.some(m => MASTER_NAMES.includes(m.name.toLowerCase()))

  for (const member of members) {
    const isMaster = MASTER_NAMES.includes(member.name.toLowerCase())
    const loginUsername = member.login_username || member.name
    const password = memberPassword(member.name)
    const passwordHash = hashPassword(loginUsername, password)

    await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        login_username: loginUsername,
        password_hash: passwordHash,
        role: isMaster ? 'MASTER' : 'MEMBER',
      },
    })
    console.log(`  ${member.name} → login: ${loginUsername} / ${password} (${isMaster ? 'MASTER' : 'MEMBER'})`)
  }

  if (!jhonnyExists) {
    const loginUsername = 'Jhonny'
    const password = memberPassword('Jhonny')
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
    console.log(`  Created Jhonny → login: Jhonny / ${password} (MASTER)`)
  }

  // Clear legacy single-admin session keys
  await prisma.setting.deleteMany({
    where: { key: { in: ['admin_session_token', 'admin_username', 'admin_password_hash'] } },
  }).catch(() => {})

  console.log('Done.')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
