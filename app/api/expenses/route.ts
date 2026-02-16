import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { CreateExpenseRequest } from '@/lib/types';

// GET all expenses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const db = getDatabase();
    let query = 'SELECT * FROM expenses';
    const params: any[] = [];

    if (startDate && endDate) {
      query += ' WHERE expense_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY expense_date DESC';

    const expenses = await db.prepare(query).all(...params);
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST create new expense
export async function POST(request: NextRequest) {
  try {
    const body: CreateExpenseRequest = await request.json();
    const { description, amount, category, expense_date } = body;

    if (!description || !amount || !expense_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO expenses (description, amount, category, expense_date)
      VALUES (?, ?, ?, ?)
    `);
    const result = await stmt.run(description, amount, category || null, expense_date);

    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

// DELETE expense
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
    await stmt.run(id);

    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
