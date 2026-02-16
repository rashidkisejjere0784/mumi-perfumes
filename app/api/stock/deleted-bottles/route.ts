import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import type { DeletedBottleRecord } from '@/lib/types';

export async function GET() {
  try {
    const db = getDatabase();
    const deleted = db.prepare(`
      SELECT
        db.id,
        db.stock_group_id,
        db.perfume_id,
        p.name as perfume_name,
        ss.shipment_name,
        ss.purchase_date,
        db.quantity_removed,
        db.reason,
        db.note,
        db.removed_at
      FROM deleted_bottles db
      LEFT JOIN perfumes p ON p.id = db.perfume_id
      LEFT JOIN stock_groups sg ON sg.id = db.stock_group_id
      LEFT JOIN stock_shipments ss ON ss.id = sg.shipment_id
      ORDER BY db.removed_at DESC
    `).all() as DeletedBottleRecord[];

    return NextResponse.json(deleted);
  } catch (error) {
    console.error('Error fetching deleted bottles:', error);
    return NextResponse.json({ error: 'Failed to fetch deleted bottles' }, { status: 500 });
  }
}
