import 'server-only';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, buildSessionToken, verifySessionToken } from './auth-token';

const AUTH_EMAIL = process.env.AUTH_EMAIL ?? 'admin@demo.pl';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? 'demo';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function checkCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === AUTH_EMAIL.toLowerCase() && password === AUTH_PASSWORD;
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
