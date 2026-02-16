import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'mumi-perfumes-secret-key-change-in-production';

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export async function getCurrentUser(): Promise<TokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return null;
    }
    
    return verifyToken(token);
  } catch (error) {
    return null;
  }
}

export function setAuthCookie(token: string) {
  return {
    'Set-Cookie': `auth_token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`,
  };
}

export function clearAuthCookie() {
  return {
    'Set-Cookie': 'auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict',
  };
}
