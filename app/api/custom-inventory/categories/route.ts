import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import type { CustomInventoryCategory } from '@/lib/types';

export async function GET() {
  try {
    const db = getDatabase();
    const rows = await db.prepare(`
      SELECT *
      FROM custom_inventory_categories
      WHERE is_active = 1
      ORDER BY name ASC
    `).all() as CustomInventoryCategory[];
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching custom inventory categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDatabase();
    const body = await request.json();
    const name = String(body?.name || '').trim().toLowerCase();
    const description = String(body?.description || '').trim() || null;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const result = await db.prepare(`
      INSERT INTO custom_inventory_categories (name, description, is_active)
      VALUES (?, ?, 1)
    `).run(name, description);

    const created = await db.prepare(`
      SELECT *
      FROM custom_inventory_categories
      WHERE id = ?
    `).get(result.lastInsertRowid) as CustomInventoryCategory;

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating category:', error);
    const msg = String(error?.message || error?.code || '');
    if (msg.includes('UNIQUE') || msg.includes('Duplicate entry') || msg.includes('ER_DUP_ENTRY')) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
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

    const category = await db.prepare(`
      SELECT id, name
      FROM custom_inventory_categories
      WHERE id = ? AND is_active = 1
    `).get(id) as { id: number; name: string } | undefined;

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const usage = await db.prepare(`
      SELECT COUNT(*) as count
      FROM custom_inventory_items
      WHERE category = ? AND is_active = 1
    `).get(category.name) as { count: number };

    if (usage.count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that has active items' },
        { status: 400 }
      );
    }

    await db.prepare(`
      UPDATE custom_inventory_categories
      SET is_active = 0
      WHERE id = ?
    `).run(id);

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
