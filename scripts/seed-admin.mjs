// Seed admin login credentials into the Setting table.
// Usage: node scripts/seed-admin.mjs [username] [password]
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const username = process.argv[2] || 'Master'
const password = process.argv[3] || 'Pakistan@125'

function hashPassword(user, pass) {
  return crypto.createHash('sha256').update(`${user}:${pass}:qc-salt`).digest('hex')
}

const prisma = new PrismaClient()

try {
  const hash = hashPassword(username, password)
  await prisma.setting.upsert({
    where: { key: 'admin_username' },
    update: { value: username },
    create: { key: 'admin_username', value: username },
  })
  await prisma.setting.upsert({
    where: { key: 'admin_password_hash' },
    update: { value: hash },
    create: { key: 'admin_password_hash', value: hash },
  })
  console.log(`Admin credentials seeded: username="${username}"`)
} finally {
  await prisma.$disconnect()
}
