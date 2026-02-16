import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

interface AdjustmentRow {
  id: number;
  type: string;
  previous_amount: number;
  new_amount: number;
  adjustment: number;
  reason: string | null;
  adjusted_at: string;
}

// GET adjustment history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'liquid_cash' | 'capital' | null (all)

    const db = getDatabase();

    let query = 'SELECT * FROM cash_adjustments';
    const params: string[] = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY adjusted_at DESC, id DESC';

    const rows = await db.prepare(query).all(...params);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching adjustments:', error);
    return NextResponse.json({ error: 'Failed to fetch adjustments' }, { status: 500 });
  }
}

// POST create a manual adjustment (reset liquid cash or capital to a specific amount)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = String(body?.type || '').trim();
    const newAmount = Number(body?.new_amount);
    const reason = String(body?.reason || '').trim() || null;

    if (!type || !['liquid_cash', 'capital'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "liquid_cash" or "capital"' },
        { status: 400 },
      );
    }

    if (Number.isNaN(newAmount) || newAmount < 0) {
      return NextResponse.json(
        { error: 'new_amount must be a non-negative number' },
        { status: 400 },
      );
    }

    const db = getDatabase();

    // Compute the current value so we can record the delta
    let currentAmount = 0;

    if (type === 'liquid_cash') {
      const salesCash = (await db
        .prepare('SELECT COALESCE(SUM(amount_paid), 0) as total FROM sales')
        .get()) as { total: number };
      const expenses = (await db
        .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses')
        .get()) as { total: number };
      const prevAdj = (await db
        .prepare(
          "SELECT COALESCE(SUM(adjustment), 0) as total FROM cash_adjustments WHERE type = 'liquid_cash'",
        )
        .get()) as { total: number };

      currentAmount =
        Number(salesCash.total || 0) -
        Number(expenses.total || 0) +
        Number(prevAdj.total || 0);
    } else {
      // capital
      const manualInvestments = (await db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as total
           FROM investments
           WHERE source_shipment_id IS NULL
             AND description NOT LIKE 'Stock purchase (capital)%'`,
        )
        .get()) as { total: number };
      const prevAdj = (await db
        .prepare(
          "SELECT COALESCE(SUM(adjustment), 0) as total FROM cash_adjustments WHERE type = 'capital'",
        )
        .get()) as { total: number };

      currentAmount = Number(manualInvestments.total || 0) + Number(prevAdj.total || 0);
    }

    const adjustment = newAmount - currentAmount;

    const result = await db
      .prepare(
        `INSERT INTO cash_adjustments (type, previous_amount, new_amount, adjustment, reason)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(type, currentAmount, newAmount, adjustment, reason);

    const created = (await db
      .prepare('SELECT * FROM cash_adjustments WHERE id = ?')
      .get(result.lastInsertRowid)) as AdjustmentRow;

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating adjustment:', error);
    return NextResponse.json({ error: 'Failed to create adjustment' }, { status: 500 });
  }
}
