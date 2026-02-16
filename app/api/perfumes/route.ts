import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { CreatePerfumeRequest, Perfume } from '@/lib/types';

// GET all perfumes
export async function GET() {
  try {
    const db = getDatabase();
    const perfumes = db.prepare('SELECT * FROM perfumes ORDER BY name').all() as Perfume[];
    return NextResponse.json(perfumes);
  } catch (error) {
    console.error('Error fetching perfumes:', error);
    return NextResponse.json({ error: 'Failed to fetch perfumes' }, { status: 500 });
  }
}

// POST create new perfume
export async function POST(request: NextRequest) {
  try {
    const body: CreatePerfumeRequest = await request.json();
    const { name, volume_ml, estimated_decants_per_bottle } = body;

    if (!name || !volume_ml || !estimated_decants_per_bottle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDatabase();
    const stmt = db.prepare(
      'INSERT INTO perfumes (name, volume_ml, estimated_decants_per_bottle) VALUES (?, ?, ?)'
    );
    const result = stmt.run(name, volume_ml, estimated_decants_per_bottle);

    const newPerfume = db.prepare('SELECT * FROM perfumes WHERE id = ?').get(result.lastInsertRowid) as Perfume;

    return NextResponse.json(newPerfume, { status: 201 });
  } catch (error: any) {
    console.error('Error creating perfume:', error);
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Perfume with this name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create perfume' }, { status: 500 });
  }
}

// PUT update perfume
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, volume_ml, estimated_decants_per_bottle, is_out_of_stock } = body;

    if (!id) {
      return NextResponse.json({ error: 'Perfume ID is required' }, { status: 400 });
    }

    const db = getDatabase();
    const stmt = db.prepare(
      `UPDATE perfumes
       SET name = COALESCE(?, name),
           volume_ml = COALESCE(?, volume_ml),
           estimated_decants_per_bottle = COALESCE(?, estimated_decants_per_bottle),
           is_out_of_stock = COALESCE(?, is_out_of_stock)
       WHERE id = ?`
    );
    stmt.run(
      name ?? null,
      volume_ml ?? null,
      estimated_decants_per_bottle ?? null,
      typeof is_out_of_stock === 'number' ? is_out_of_stock : null,
      id
    );

    const updatedPerfume = db.prepare('SELECT * FROM perfumes WHERE id = ?').get(id) as Perfume;

    return NextResponse.json(updatedPerfume);
  } catch (error) {
    console.error('Error updating perfume:', error);
    return NextResponse.json({ error: 'Failed to update perfume' }, { status: 500 });
  }
}

// DELETE perfume
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Perfume ID is required' }, { status: 400 });
    }

    const db = getDatabase();
    
    // Check if perfume has stock or sales
    const stockCount = db.prepare('SELECT COUNT(*) as count FROM stock_groups WHERE perfume_id = ?').get(id) as { count: number };
    if (stockCount.count > 0) {
      return NextResponse.json({ error: 'Cannot delete perfume with existing stock' }, { status: 400 });
    }

    const stmt = db.prepare('DELETE FROM perfumes WHERE id = ?');
    stmt.run(id);

    return NextResponse.json({ message: 'Perfume deleted successfully' });
  } catch (error) {
    console.error('Error deleting perfume:', error);
    return NextResponse.json({ error: 'Failed to delete perfume' }, { status: 500 });
  }
}
