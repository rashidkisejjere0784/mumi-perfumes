import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ message: 'Logout successful' });
  response.headers.set(...Object.entries(clearAuthCookie())[0]);
  return response;
}
