import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import type { CustomInventoryItem } from '@/lib/types';

export async function GET() {
  try {
    const db = getDatabase();
    const includeInactive = false;

    const items = await db.prepare(`
      SELECT *
      FROM custom_inventory_items
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY created_at DESC
    `).all() as CustomInventoryItem[];

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching custom inventory items:', error);
    return NextResponse.json({ error: 'Failed to fetch custom inventory items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDatabase();

    const body = await request.json();
    const name = String(body?.name || '').trim();
    const category = String(body?.category || '').trim();
    const unitLabel = String(body?.unit_label || '').trim() || null;
    const defaultMlRaw = body?.default_ml;
    const defaultMl = defaultMlRaw === '' || defaultMlRaw === null || defaultMlRaw === undefined
      ? null
      : Number(defaultMlRaw);

    if (!name || !category) {
      return NextResponse.json({ error: 'name and category are required' }, { status: 400 });
    }

    const validCategory = await db.prepare(`
      SELECT id
      FROM custom_inventory_categories
      WHERE name = ? AND is_active = 1
    `).get(category);
    if (!validCategory) {
      return NextResponse.json({ error: 'Selected category does not exist' }, { status: 400 });
    }

    const stmt = db.prepare(`
      INSERT INTO custom_inventory_items (name, category, unit_label, default_ml, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const result = await stmt.run(name, category, unitLabel, defaultMl);

    const created = await db.prepare(`
      SELECT *
      FROM custom_inventory_items
      WHERE id = ?
    `).get(result.lastInsertRowid) as CustomInventoryItem;

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating custom inventory item:', error);
    const msg = String(error?.message || error?.code || '');
    if (msg.includes('UNIQUE') || msg.includes('Duplicate entry') || msg.includes('ER_DUP_ENTRY')) {
      return NextResponse.json({ error: 'Item name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create custom inventory item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDatabase();

    const body = await request.json();
    const id = Number(body?.id);
    const name = String(body?.name || '').trim();
    const category = String(body?.category || '').trim();
    const unitLabel = String(body?.unit_label || '').trim() || null;
    const defaultMlRaw = body?.default_ml;
    const defaultMl = defaultMlRaw === '' || defaultMlRaw === null || defaultMlRaw === undefined
      ? null
      : Number(defaultMlRaw);

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Valid id is required' }, { status: 400 });
    }
    if (!name || !category) {
      return NextResponse.json({ error: 'name and category are required' }, { status: 400 });
    }

    const validCategory = await db.prepare(`
      SELECT id
      FROM custom_inventory_categories
      WHERE name = ? AND is_active = 1
    `).get(category);
    if (!validCategory) {
      return NextResponse.json({ error: 'Selected category does not exist' }, { status: 400 });
    }

    await db.prepare(`
      UPDATE custom_inventory_items
      SET name = ?, category = ?, unit_label = ?, default_ml = ?
      WHERE id = ?
    `).run(name, category, unitLabel, defaultMl, id);

    const updated = await db.prepare(`
      SELECT *
      FROM custom_inventory_items
      WHERE id = ?
    `).get(id) as CustomInventoryItem | undefined;

    if (!updated) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating custom inventory item:', error);
    const msg = String(error?.message || error?.code || '');
    if (msg.includes('UNIQUE') || msg.includes('Duplicate entry') || msg.includes('ER_DUP_ENTRY')) {
      return NextResponse.json({ error: 'Item name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update custom inventory item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDatabase();
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Valid id is required' }, { status: 400 });
    }

    const existing = await db.prepare('SELECT id FROM custom_inventory_items WHERE id = ?').get(id) as { id: number } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Soft delete to preserve historical stock rows.
    await db.prepare('UPDATE custom_inventory_items SET is_active = 0 WHERE id = ?').run(id);

    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom inventory item:', error);
    return NextResponse.json({ error: 'Failed to delete custom inventory item' }, { status: 500 });
  }
}
