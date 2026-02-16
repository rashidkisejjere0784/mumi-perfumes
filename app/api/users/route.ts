import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/lib/auth';
import { User } from '@/lib/types';

// GET all users (admin only)
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = getDatabase();
    const users = db.prepare('SELECT id, username, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC').all() as User[];

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { username, password, full_name, role } = await request.json();

    if (!username || !password || !full_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDatabase();

    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `).run(username, passwordHash, full_name, role || 'user');

    const newUser = db.prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid) as User;

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

// PUT update user
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, username, full_name, role, is_active, password } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Only admin can update other users or change roles
    if (currentUser.role !== 'admin' && (currentUser.userId !== id || role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = getDatabase();

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    }

    if (username || full_name || role !== undefined || is_active !== undefined) {
      const updates: string[] = [];
      const values: any[] = [];

      if (username) {
        updates.push('username = ?');
        values.push(username);
      }
      if (full_name) {
        updates.push('full_name = ?');
        values.push(full_name);
      }
      if (role !== undefined && currentUser.role === 'admin') {
        updates.push('role = ?');
        values.push(role);
      }
      if (is_active !== undefined && currentUser.role === 'admin') {
        updates.push('is_active = ?');
        values.push(is_active);
      }

      if (updates.length > 0) {
        values.push(id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }
    }

    const updatedUser = db.prepare('SELECT id, username, full_name, role, is_active, created_at, last_login FROM users WHERE id = ?').get(id) as User;

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE user (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent deleting self
    if (parseInt(id) === currentUser.userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const db = getDatabase();
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
