import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, buildSessionToken, verifySessionToken } from './auth-token';

const AUTH_EMAIL = process.env.AUTH_EMAIL ?? 'admin@demo.pl';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? 'demo';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function checkCredentials(email: string, password: string): boolean {
  if (email.trim().toLowerCase() !== AUTH_EMAIL.trim().toLowerCase()) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(AUTH_PASSWORD);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createSession(email: string): Promise<void> {
  const token = buildSessionToken(email);
  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
}

export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<string> {
  const email = await getSessionEmail();
  if (!email) throw new Error('UNAUTHORIZED');
  return email;
}
