import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Podpis ciasteczka sesji (granica zaufania Z13). `src/lib/env.ts` waliduje
 * zmienne środowiskowe przy pierwszym imporcie, więc moduł ładujemy dopiero
 * po ustawieniu ich w tym przebiegu — dane są syntetyczne, nic prawdziwego.
 */
process.env.DATABASE_URL ??= 'postgres://test/test';
process.env.SESSION_SECRET ??= 'test-secret-o-dlugosci-co-najmniej-32-znakow';

type AuthToken = typeof import('./auth-token');
let mod: AuthToken;

beforeAll(async () => {
  mod = await import('./auth-token');
});

describe('buildSessionToken i verifySessionToken', () => {
  it('token zbudowany dla adresu wraca jako ten sam adres, małymi literami', () => {
    expect(mod.verifySessionToken(mod.buildSessionToken('Admin@Demo.pl'))).toBe('admin@demo.pl');
  });

  it('token z podmienionym podpisem albo ładunkiem nie przechodzi', () => {
    const token = mod.buildSessionToken('admin@demo.pl');
    const [payload, sig] = [token.slice(0, token.lastIndexOf('.')), token.slice(token.lastIndexOf('.') + 1)];
    expect(mod.verifySessionToken(`intruz@demo.pl.${Date.now()}.${sig}`)).toBeNull();
    expect(mod.verifySessionToken(`${payload}.${'a'.repeat(sig.length)}`)).toBeNull();
  });

  it('brak tokenu i token bez kropki to brak sesji, nie wyjątek', () => {
    expect(mod.verifySessionToken(undefined)).toBeNull();
    expect(mod.verifySessionToken(null)).toBeNull();
    expect(mod.verifySessionToken('bezkropki')).toBeNull();
  });

  it('token starszy niż okno sesji przestaje być ważny', () => {
    // Token podpisany ręcznie tym samym sekretem, ze znacznikiem czasu sprzed
    // okna sesji — bez podmieniania zegara procesu.
    const stale = `admin@demo.pl.${Date.now() - mod.SESSION_MAX_MS - 1000}`;
    const sig = createHmac('sha256', process.env.SESSION_SECRET as string)
      .update(stale)
      .digest('base64url');
    expect(mod.verifySessionToken(`${stale}.${sig}`)).toBeNull();
    // Ten sam ładunek ze świeżym znacznikiem przechodzi — dowód, że o wynik
    // powyżej zadecydował czas, nie zły podpis.
    const fresh = `admin@demo.pl.${Date.now()}`;
    const freshSig = createHmac('sha256', process.env.SESSION_SECRET as string)
      .update(fresh)
      .digest('base64url');
    expect(mod.verifySessionToken(`${fresh}.${freshSig}`)).toBe('admin@demo.pl');
  });
});
