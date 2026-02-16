import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { CreateInvestmentRequest } from '@/lib/types';

// GET investments (default: manual cash investments only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAuto = searchParams.get('include_auto') === 'true';
    const db = getDatabase();
    try {
      await db.exec(`ALTER TABLE investments ADD COLUMN source_shipment_id INTEGER`);
    } catch (_) {
      // Column already exists
    }

    const query = includeAuto
      ? `SELECT * FROM investments ORDER BY investment_date DESC, id DESC`
      : `
        SELECT *
        FROM investments
        WHERE source_shipment_id IS NULL
          AND description NOT LIKE 'Stock purchase (capital)%'
        ORDER BY investment_date DESC, id DESC
      `;

    const investments = await db.prepare(query).all();
    return NextResponse.json(investments);
  } catch (error) {
    console.error('Error fetching investments:', error);
    return NextResponse.json({ error: 'Failed to fetch investments' }, { status: 500 });
  }
}

// POST create new investment
export async function POST(request: NextRequest) {
  try {
    const body: CreateInvestmentRequest = await request.json();
    const { description, amount, investment_date } = body;

    if (!description || !amount || !investment_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO investments (description, amount, investment_date)
      VALUES (?, ?, ?)
    `);
    const result = await stmt.run(description, amount, investment_date);

    const investment = await db.prepare('SELECT * FROM investments WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json(investment, { status: 201 });
  } catch (error) {
    console.error('Error creating investment:', error);
    return NextResponse.json({ error: 'Failed to create investment' }, { status: 500 });
  }
}

// DELETE investment (only manual investments can be deleted)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Investment ID is required' }, { status: 400 });
    }

    const db = getDatabase();
    try {
      await db.exec(`ALTER TABLE investments ADD COLUMN source_shipment_id INTEGER`);
    } catch (_) {
      // Column already exists
    }

    const investment = await db.prepare('SELECT id, source_shipment_id FROM investments WHERE id = ?').get(id) as {
      id: number;
      source_shipment_id: number | null;
    } | undefined;

    if (!investment) {
      return NextResponse.json({ error: 'Investment not found' }, { status: 404 });
    }

    if (investment.source_shipment_id) {
      return NextResponse.json(
        { error: 'Cannot delete auto-generated investment linked to a shipment. Delete the shipment instead.' },
        { status: 400 },
      );
    }

    await db.prepare('DELETE FROM investments WHERE id = ?').run(id);
    return NextResponse.json({ message: 'Investment deleted successfully' });
  } catch (error) {
    console.error('Error deleting investment:', error);
    return NextResponse.json({ error: 'Failed to delete investment' }, { status: 500 });
  }
}
