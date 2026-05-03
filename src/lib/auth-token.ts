import { createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE = 'mc_session';

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'marketing-crew-dev-secret';

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
  const [email] = payload.split('.');
  return email ?? null;
}
