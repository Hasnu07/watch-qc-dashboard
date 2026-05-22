import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const members = await prisma.teamMember.findMany({
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(members)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, whatsapp_number, department } = body

    if (!name || !whatsapp_number) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validDepts = ['LOGISTICS', 'ACCOUNTING', 'SALES']
    const dept = validDepts.includes(department) ? department : 'LOGISTICS'

    const cleanNumber = whatsapp_number.replace(/[^0-9]/g, '')

    const member = await prisma.teamMember.create({
      data: { name, whatsapp_number: cleanNumber, department: dept },
    })

    return NextResponse.json(member, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 })
  }
}
