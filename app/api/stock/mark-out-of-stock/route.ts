import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const stock_group_id = Number(body.stock_group_id);
    const quantity = Number(body.quantity ?? 1);
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const reason = 'out_of_stock';

    if (!stock_group_id || Number.isNaN(stock_group_id)) {
      return NextResponse.json({ error: 'stock_group_id is required' }, { status: 400 });
    }

    if (!quantity || Number.isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'quantity must be greater than 0' }, { status: 400 });
    }

    const db = getDatabase();
    const stock = db.prepare(`
      SELECT id, perfume_id, remaining_quantity
      FROM stock_groups
      WHERE id = ?
    `).get(stock_group_id) as { id: number; perfume_id: number; remaining_quantity: number } | undefined;

    if (!stock) {
      return NextResponse.json({ error: 'Stock group not found' }, { status: 404 });
    }

    if ((stock.remaining_quantity || 0) < quantity) {
      return NextResponse.json(
        { error: `Cannot remove ${quantity}. Only ${stock.remaining_quantity} bottle(s) remaining.` },
        { status: 400 }
      );
    }

    db.prepare(`
      UPDATE stock_groups
      SET remaining_quantity = remaining_quantity - ?
      WHERE id = ?
    `).run(quantity, stock_group_id);

    db.prepare(`
      INSERT INTO deleted_bottles
      (stock_group_id, perfume_id, quantity_removed, reason, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(stock_group_id, stock.perfume_id, quantity, reason, note || null);

    return NextResponse.json({
      message: 'Bottle(s) marked out of stock',
      stock_group_id,
      quantity_removed: quantity,
    });
  } catch (error) {
    console.error('Error marking bottle out of stock:', error);
    return NextResponse.json({ error: 'Failed to mark bottle out of stock' }, { status: 500 });
  }
}
