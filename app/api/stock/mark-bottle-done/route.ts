import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const stock_group_id = Number(body.stock_group_id);
    const manualDecants = body.decants_obtained !== undefined ? Number(body.decants_obtained) : null;

    if (!stock_group_id || Number.isNaN(stock_group_id)) {
      return NextResponse.json({ error: 'stock_group_id is required' }, { status: 400 });
    }

    const db = getDatabase();

    const stock = await db.prepare(`
      SELECT sg.id, sg.quantity, sg.perfume_id, dt.decants_sold, dt.bottles_sold, dt.bottles_done
      FROM stock_groups sg
      LEFT JOIN decant_tracking dt ON dt.stock_group_id = sg.id
      WHERE sg.id = ?
    `).get(stock_group_id) as {
      id: number;
      quantity: number;
      perfume_id: number;
      decants_sold: number;
      bottles_sold: number;
      bottles_done: number;
    } | undefined;

    if (!stock) {
      return NextResponse.json({ error: 'Stock group not found' }, { status: 404 });
    }

    const maxDecantableBottles = Math.max(0, stock.quantity - (stock.bottles_sold || 0));
    if ((stock.bottles_done || 0) >= maxDecantableBottles) {
      return NextResponse.json(
        { error: 'No remaining bottles available to mark as done for decants' },
        { status: 400 }
      );
    }

    const aggregatedLogs = await db.prepare(`
      SELECT
        COALESCE(SUM(decants_obtained), 0) as total_decants,
        COALESCE(MAX(bottle_sequence), 0) as max_seq
      FROM decant_bottle_logs
      WHERE stock_group_id = ?
    `).get(stock_group_id) as { total_decants: number; max_seq: number };

    const decantsSinceLastDone = Math.max(0, (stock.decants_sold || 0) - (aggregatedLogs.total_decants || 0));
    const decantsObtained = manualDecants && manualDecants > 0 ? manualDecants : decantsSinceLastDone;

    if (!decantsObtained || decantsObtained <= 0) {
      return NextResponse.json(
        { error: 'Please provide decants_obtained (must be greater than 0)' },
        { status: 400 }
      );
    }

    const nextSequence = (aggregatedLogs.max_seq || 0) + 1;
    await db.prepare(`
      INSERT INTO decant_bottle_logs
      (stock_group_id, perfume_id, bottle_sequence, decants_obtained, completion_source)
      VALUES (?, ?, ?, ?, 'manual')
    `).run(stock_group_id, stock.perfume_id, nextSequence, decantsObtained);

    await db.prepare(`
      UPDATE decant_tracking
      SET bottles_done = bottles_done + 1
      WHERE stock_group_id = ?
    `).run(stock_group_id);

    return NextResponse.json({
      message: 'Bottle marked as done successfully',
      stock_group_id,
      bottle_sequence: nextSequence,
      decants_obtained: decantsObtained,
    });
  } catch (error) {
    console.error('Error marking bottle as done:', error);
    return NextResponse.json({ error: 'Failed to mark bottle as done' }, { status: 500 });
  }
}
