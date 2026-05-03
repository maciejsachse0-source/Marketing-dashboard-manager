import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env';

export const AUTH_COOKIE = 'mc_session';
export const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;

const SESSION_SECRET = env.SESSION_SECRET;

function sign(payload: string): string {
  return createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

export function buildSessionToken(email: string): string {
  const payload = `${email.toLowerCase()}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  const [email, tsStr] = payload.split('.');
  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || Date.now() - ts > SESSION_MAX_MS) return null;
  return email ?? null;
}
