import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const confirmation = String(body?.confirmation || '');
    if (confirmation !== 'CLEAR_ALL_DATA') {
      return NextResponse.json(
        { error: 'Invalid confirmation. Use CLEAR_ALL_DATA.' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    await db.transaction(async () => {
      await db.prepare('DELETE FROM sale_items').run();
      await db.prepare('DELETE FROM debt_payments').run();
      await db.prepare('DELETE FROM sales').run();
      await db.prepare('DELETE FROM decant_bottle_logs').run();
      await db.prepare('DELETE FROM decant_tracking').run();
      await db.prepare('DELETE FROM deleted_bottles').run();
      await db.prepare('DELETE FROM custom_inventory_stock_entries').run();
      await db.prepare('DELETE FROM custom_inventory_items').run();
      await db.prepare('DELETE FROM custom_inventory_categories').run();
      await db.prepare('DELETE FROM stock_groups').run();
      await db.prepare('DELETE FROM stock_shipments').run();
      await db.prepare('DELETE FROM expenses').run();
      await db.prepare('DELETE FROM investments').run();
      await db.prepare('DELETE FROM cash_adjustments').run();
      await db.prepare('DELETE FROM perfumes').run();

      // Reset autoincrement counters for wiped tables (users intentionally preserved).
      const tablesToReset = [
        'sale_items', 'debt_payments', 'sales', 'decant_bottle_logs',
        'decant_tracking', 'deleted_bottles', 'stock_groups',
        'stock_shipments', 'expenses', 'investments', 'cash_adjustments',
        'perfumes', 'custom_inventory_stock_entries', 'custom_inventory_items',
        'custom_inventory_categories',
      ];
      for (const table of tablesToReset) {
        try {
          await db.exec(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
        } catch (_) {
          // Ignore errors (e.g. if table doesn't exist yet)
        }
      }
    });

    return NextResponse.json({ message: 'All business data cleared successfully. Users were preserved.' });
  } catch (error) {
    console.error('Error clearing business data:', error);
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 });
  }
}
