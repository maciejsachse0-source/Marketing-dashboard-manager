import { describe, expect, it } from 'vitest';
import { dryRun } from './dry-run';
import type { ExistingPerson } from './dedup';

const MAPPING = ['name', 'handle', 'email', 'location'] as const;

const ISTNIEJACY: ExistingPerson[] = [
  {
    id: 1,
    role: 'artist',
    name: 'Ala Testowa 0001',
    handle: '@atrapa_0001',
    email: null,
    phone: null,
    location: 'Warszawa',
    status: null,
    notes: null,
  },
];

describe('dryRun', () => {
  it('liczy wstawki, duplikaty, błędy i wiersze puste', () => {
    const rows = [
      ['Bea Nowa 0002', '@atrapa_0002', 'b@przyklad.test', 'Kraków'],
      ['Ala Kopia', '@atrapa_0001', '', 'Warszawa'],
      ['', '', '', ''],
      ['Cyla Zla 0003', '', 'zly-email', 'Poznań'],
    ];

    const wynik = dryRun(rows, MAPPING, 'artist', ISTNIEJACY, 'skip');

    expect(wynik.inserts).toBe(1);
    expect(wynik.updates).toBe(0);
    expect(wynik.skips).toBe(1);
    expect(wynik.errors).toBe(1);
    expect(wynik.empty).toBe(1);
  });

  it('polityka update zamienia pominięcie duplikatu pewnego na aktualizację', () => {
    const rows = [['Ala Kopia', '@atrapa_0001', 'nowy@przyklad.test', 'Warszawa']];

    expect(dryRun(rows, MAPPING, 'artist', ISTNIEJACY, 'skip').skips).toBe(1);

    const wynik = dryRun(rows, MAPPING, 'artist', ISTNIEJACY, 'update');
    expect(wynik.updates).toBe(1);
    expect(wynik.plans[0].plan.action).toBe('update');
  });

  it('numeruje wiersze tak jak arkusz, czyli od 2', () => {
    const rows = [['Bea Nowa 0002', '@atrapa_0002', '', 'Kraków']];
    expect(dryRun(rows, MAPPING, 'artist', [], 'skip').plans[0].line).toBe(2);
  });

  it('podgląd jest przycięty do limitu, liczniki nie', () => {
    const rows = Array.from({ length: 30 }, (_, i) => [`Osoba ${i}`, `@atrapa_x${i}`, '', 'Kraków']);
    const wynik = dryRun(rows, MAPPING, 'artist', [], 'skip', 20);
    expect(wynik.preview).toHaveLength(20);
    expect(wynik.inserts).toBe(30);
  });

  it('zbiera treści błędów wiersz po wierszu do pobrania', () => {
    const rows = [['', '', '', 'Kraków']];
    const wynik = dryRun(rows, MAPPING, 'artist', [], 'skip');
    expect(wynik.errorRows).toHaveLength(1);
    expect(wynik.errorRows[0].line).toBe(2);
    expect(wynik.errorRows[0].errors.length).toBeGreaterThan(0);
  });

  it('kolumna niezmapowana nie trafia do osoby', () => {
    const rows = [['Bea Nowa 0002', '@atrapa_0002', 'b@przyklad.test', 'Kraków']];
    const wynik = dryRun(rows, ['name', null, null, null], 'artist', [], 'skip');
    expect(wynik.plans[0].person.handle).toBeNull();
    expect(wynik.plans[0].person.email).toBeNull();
  });
});
