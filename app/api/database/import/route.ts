import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { getCurrentUser } from '@/lib/auth';

// Tables in FK-safe insertion order (parents first).
const IMPORT_ORDER = [
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

// Reverse for deletion (children first).
const DELETE_ORDER = [...IMPORT_ORDER].reverse();

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 403 });
    }

    const body = await request.json();

    if (!body || !body.tables || typeof body.tables !== 'object') {
      return NextResponse.json(
        { error: 'Invalid backup file. Expected JSON with a "tables" object.' },
        { status: 400 },
      );
    }

    const tables: Record<string, any[]> = body.tables;

    const db = getDatabase();

    // Disable FK checks for the duration of the import.
    await db.exec('SET FOREIGN_KEY_CHECKS = 0');

    try {
      // 1. Delete all existing data (children first).
      for (const table of DELETE_ORDER) {
        try {
          await db.prepare(`DELETE FROM ${table}`).run();
        } catch (_) {
          // Table might not exist — skip
        }
      }

      // Reset auto-increment counters.
      for (const table of IMPORT_ORDER) {
        try {
          await db.exec(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
        } catch (_) {
          // ignore
        }
      }

      // 2. Insert rows in FK-safe order (parents first).
      const stats: Record<string, number> = {};

      for (const table of IMPORT_ORDER) {
        const rows = tables[table];
        if (!Array.isArray(rows) || rows.length === 0) {
          stats[table] = 0;
          continue;
        }

        // Use column names from first row.
        const columns = Object.keys(rows[0]);
        if (columns.length === 0) {
          stats[table] = 0;
          continue;
        }

        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        const stmt = db.prepare(sql);

        let inserted = 0;
        for (const row of rows) {
          const values = columns.map((col) => {
            const v = row[col];
            if (v === null || v === undefined) return null;
            return v;
          });
          try {
            await stmt.run(...values);
            inserted++;
          } catch (err: any) {
            // Skip duplicate key errors so re-imports are resilient.
            const msg = String(err?.message || err?.code || '');
            if (msg.includes('Duplicate entry') || msg.includes('ER_DUP_ENTRY')) {
              continue;
            }
            console.error(`Error inserting into ${table}:`, err);
          }
        }

        stats[table] = inserted;
      }

      // 3. Also import users if present (but skip if users already exist from seed).
      if (Array.isArray(tables.users) && tables.users.length > 0) {
        const userColumns = Object.keys(tables.users[0]);
        const userPlaceholders = userColumns.map(() => '?').join(', ');
        const userSql = `INSERT INTO users (${userColumns.join(', ')}) VALUES (${userPlaceholders})`;

        // Clear existing users first so the import fully replaces them.
        await db.prepare('DELETE FROM users').run();
        await db.exec('ALTER TABLE users AUTO_INCREMENT = 1');

        const stmt = db.prepare(userSql);
        let inserted = 0;
        for (const row of tables.users) {
          const values = userColumns.map((col) => row[col] ?? null);
          try {
            await stmt.run(...values);
            inserted++;
          } catch (err: any) {
            const msg = String(err?.message || err?.code || '');
            if (msg.includes('Duplicate entry') || msg.includes('ER_DUP_ENTRY')) continue;
            console.error('Error inserting user:', err);
          }
        }
        stats['users'] = inserted;
      }

      return NextResponse.json({
        message: 'Database imported successfully',
        stats,
      });
    } finally {
      // Re-enable FK checks regardless of success/failure.
      await db.exec('SET FOREIGN_KEY_CHECKS = 1');
    }
  } catch (error) {
    console.error('Database import error:', error);
    return NextResponse.json({ error: 'Failed to import database' }, { status: 500 });
  }
}
