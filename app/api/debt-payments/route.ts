import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { CreateDebtPaymentRequest } from '@/lib/types';

// GET debt payments for a sale
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const saleId = searchParams.get('sale_id');

    if (!saleId) {
      return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
    }

    const db = getDatabase();
    const payments = await db.prepare('SELECT * FROM debt_payments WHERE sale_id = ? ORDER BY payment_date DESC').all(saleId);

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching debt payments:', error);
    return NextResponse.json({ error: 'Failed to fetch debt payments' }, { status: 500 });
  }
}

// POST create debt payment
export async function POST(request: NextRequest) {
  try {
    const body: CreateDebtPaymentRequest = await request.json();
    const { sale_id, amount_paid, payment_date, payment_method } = body;

    if (!sale_id || !amount_paid || !payment_date || !payment_method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDatabase();

    // Get current debt amount
    const sale = await db.prepare('SELECT debt_amount FROM sales WHERE id = ?').get(sale_id) as { debt_amount: number } | undefined;
    
    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    if (amount_paid > sale.debt_amount) {
      return NextResponse.json({ error: 'Payment amount exceeds outstanding debt' }, { status: 400 });
    }

    // Insert payment
    const insertPayment = db.prepare(`
      INSERT INTO debt_payments (sale_id, amount_paid, payment_date, payment_method)
      VALUES (?, ?, ?, ?)
    `);
    const result = await insertPayment.run(sale_id, amount_paid, payment_date, payment_method);

    // Update sale debt amount and amount paid
    const updateSale = db.prepare(`
      UPDATE sales 
      SET debt_amount = debt_amount - ?,
          amount_paid = amount_paid + ?
      WHERE id = ?
    `);
    await updateSale.run(amount_paid, amount_paid, sale_id);

    const payment = await db.prepare('SELECT * FROM debt_payments WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error creating debt payment:', error);
    return NextResponse.json({ error: 'Failed to create debt payment' }, { status: 500 });
  }
}
