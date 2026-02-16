import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { getCurrentUser } from '@/lib/auth';

// Tables exported in FK-safe order (parents before children).
const EXPORT_TABLES = [
  'users',
  'perfumes',
  'custom_inventory_categories',
  'stock_shipments',
  'custom_inventory_items',
  'stock_groups',
  'sales',
  'decant_tracking',
  'decant_bottle_logs',
  'deleted_bottles',
  'sale_items',
  'custom_inventory_stock_entries',
  'debt_payments',
  'expenses',
  'investments',
  'cash_adjustments',
];

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 403 });
    }

    const db = getDatabase();

    const data: Record<string, any[]> = {};

    for (const table of EXPORT_TABLES) {
      try {
        const rows = await db.prepare(`SELECT * FROM ${table}`).all();
        data[table] = rows;
      } catch (err) {
        // Table might not exist yet — skip gracefully
        data[table] = [];
      }
    }

    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      tables: data,
    };

    const json = JSON.stringify(payload, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];

    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="mumi_pos_backup_${dateStr}.json"`,
      },
    });
  } catch (error) {
    console.error('Database export error:', error);
    return NextResponse.json({ error: 'Failed to export database' }, { status: 500 });
  }
}
