// Seed login_username + password_hash for all team members (build step).
// Password pattern: {name}@125  (e.g. Aleena / Aleena@125, Master / Master@125)
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const MASTER_LOGIN = 'Master'
const LEGACY_MASTER_NAMES = ['jhonny', 'johnny']

function hashPassword(username, password) {
  return crypto.createHash('sha256').update(`${username}:${password}:qc-salt`).digest('hex')
}

function memberPassword(name) {
  return `${name.trim()}@125`
}

function isLegacyMaster(member) {
  const name = member.name.trim().toLowerCase()
  const login = (member.login_username || '').trim().toLowerCase()
  return member.role === 'MASTER' || LEGACY_MASTER_NAMES.includes(name) || LEGACY_MASTER_NAMES.includes(login)
}

async function main() {
  const members = await prisma.teamMember.findMany({ orderBy: { id: 'asc' } })
  let masterExists = false
  const masterPassword = memberPassword(MASTER_LOGIN)
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
      console.log(`  ${member.name} → login: ${MASTER_LOGIN} / ${masterPassword} (MASTER)`)
      continue
    }

    const loginUsername = (member.login_username || member.name).trim()
    const password = memberPassword(member.name)
    await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        login_username: loginUsername,
        password_hash: hashPassword(loginUsername, password),
        role: 'MEMBER',
      },
    })
    console.log(`  ${member.name} → login: ${loginUsername} / ${password} (MEMBER)`)
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
    console.log(`  Created ${MASTER_LOGIN} → login: ${MASTER_LOGIN} / ${masterPassword} (MASTER)`)
  }

  console.log('Done.')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
