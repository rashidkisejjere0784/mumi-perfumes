import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { generateToken, setAuthCookie } from '@/lib/auth';
import { User } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as User | undefined;

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash!);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Generate token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    const response = NextResponse.json({
      message: 'Login successful',
      user: userWithoutPassword,
    });

    // Set cookie
    response.headers.set(...Object.entries(setAuthCookie(token))[0]);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
