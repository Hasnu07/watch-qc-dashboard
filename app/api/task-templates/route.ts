import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureDefaultTemplates } from '@/lib/sell-tasks'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureDefaultTemplates()
    const templates = await prisma.taskTemplate.findMany({ orderBy: [{ phase: 'asc' }, { order: 'asc' }] })
    return NextResponse.json(templates)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { label, department, phase, default_assignee } = await req.json()
    if (!label?.trim() || !department || !phase) {
      return NextResponse.json({ error: 'label, department and phase required' }, { status: 400 })
    }
    const maxOrder = await prisma.taskTemplate.aggregate({ where: { phase }, _max: { order: true } })
    const template = await prisma.taskTemplate.create({
      data: { label: label.trim(), department, phase, is_builtin: false, default_assignee: default_assignee || null, order: (maxOrder._max.order ?? 0) + 1 },
    })
    return NextResponse.json(template, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
