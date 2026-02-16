import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { User } from '@/lib/types';

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ user: null });
    }

    const db = getDatabase();
    const user = await db.prepare('SELECT id, username, full_name, role, is_active, created_at, last_login FROM users WHERE id = ?').get(currentUser.userId) as User | undefined;

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ user: null });
  }
}
