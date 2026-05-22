import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const watchId = parseInt(params.id, 10)
    const payments = await prisma.watchPayment.findMany({
      where: { watch_id: watchId },
      orderBy: { payment_date: 'desc' },
    })
    return NextResponse.json(payments)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const watchId = parseInt(params.id, 10)
    const body = await req.json()
    const { amount, currency, payment_method, payment_date, notes } = body

    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    }

    const payment = await prisma.watchPayment.create({
      data: {
        watch_id: watchId,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        payment_method: payment_method || 'CASH',
        payment_date: payment_date ? new Date(payment_date) : new Date(),
        notes: notes || null,
      },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
