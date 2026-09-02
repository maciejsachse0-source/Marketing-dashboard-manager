import { describe, it, expect } from 'vitest';
import { findDuplicate, planRow, type ExistingPerson } from './dedup';
import type { NormalizedPerson } from './normalize';

function person(over: Partial<NormalizedPerson> = {}): NormalizedPerson {
  return {
    name: 'Ola Nowak',
    handle: null,
    email: null,
    phone: null,
    location: null,
    status: null,
    notes: null,
    ...over,
  };
}

function existing(over: Partial<ExistingPerson> = {}): ExistingPerson {
  return {
    id: 1,
    role: 'artist',
    name: 'Ola Nowak',
    handle: null,
    email: null,
    phone: null,
    location: null,
    status: null,
    notes: null,
    ...over,
  };
}

describe('findDuplicate - kolejność poziomów', () => {
  it('identyczny handle to duplikat pewny', () => {
    const match = findDuplicate(person({ handle: '@ola' }), 'artist', [existing({ handle: '@ola', name: 'Inna Osoba' })]);
    expect(match).toMatchObject({ level: 'certain', reason: 'handle', existing: { id: 1 } });
  });

  it('identyczny email to duplikat pewny', () => {
    const match = findDuplicate(person({ email: 'ola@przyklad.pl' }), 'artist', [existing({ email: 'ola@przyklad.pl', name: 'Inna' })]);
    expect(match).toMatchObject({ level: 'certain', reason: 'email' });
  });

  it('handle wygrywa z emailem, gdy pasują dwa różne wiersze', () => {
    const rows = [existing({ id: 7, email: 'ola@przyklad.pl' }), existing({ id: 9, handle: '@ola' })];
    const match = findDuplicate(person({ handle: '@ola', email: 'ola@przyklad.pl' }), 'artist', rows);
    expect(match).toMatchObject({ level: 'certain', reason: 'handle', existing: { id: 9 } });
  });

  it('ta sama nazwa i ta sama lokalizacja to duplikat prawdopodobny', () => {
    const match = findDuplicate(person({ location: 'Kraków' }), 'artist', [existing({ location: 'Kraków' })]);
    expect(match).toMatchObject({ level: 'probable', reason: 'name-location' });
  });

  it('pusty handle nie łączy się z pustym handle w bazie', () => {
    expect(findDuplicate(person({ name: 'Kto Inny' }), 'artist', [existing()]).level).toBe('none');
  });
});

describe('findDuplicate - granice', () => {
  it('ta sama nazwa i różne lokalizacje to nie duplikat', () => {
    const match = findDuplicate(person({ location: 'Kraków' }), 'artist', [existing({ location: 'Poznań' })]);
    expect(match.level).toBe('none');
  });

  it('nazwa bez lokalizacji po żadnej ze stron to nie duplikat prawdopodobny', () => {
    expect(findDuplicate(person(), 'artist', [existing()]).level).toBe('none');
  });

  it('porównanie nie przekracza granicy tabeli: twórca nie jest duplikatem kamerzysty', () => {
    const rows = [existing({ role: 'videographer', handle: '@ola', location: 'Kraków' })];
    expect(findDuplicate(person({ handle: '@ola', location: 'Kraków' }), 'artist', rows).level).toBe('none');
  });
});

describe('planRow - decyzja o wierszu', () => {
  it('brak duplikatu daje wstawienie', () => {
    expect(planRow(person(), 'artist', [], 'update').action).toBe('insert');
  });

  it('duplikat pewny z wyborem pomijania daje pominięcie', () => {
    const rows = [existing({ handle: '@ola' })];
    expect(planRow(person({ handle: '@ola' }), 'artist', rows, 'skip').action).toBe('skip');
  });

  it('duplikat prawdopodobny domyślnie nie jest aktualizowany', () => {
    const rows = [existing({ location: 'Kraków' })];
    const plan = planRow(person({ location: 'Kraków', notes: 'nowa notatka' }), 'artist', rows, 'update');
    expect(plan.action).toBe('skip');
  });

  it('duplikat pewny z wyborem aktualizacji daje aktualizację tylko niepustych pól', () => {
    const rows = [existing({ handle: '@ola', email: 'stary@przyklad.pl', location: 'Kraków', notes: 'stara notatka' })];
    const plan = planRow(person({ handle: '@ola', notes: 'nowa notatka' }), 'artist', rows, 'update');
    expect(plan).toMatchObject({ action: 'update', id: 1, changes: { notes: 'nowa notatka' } });
    // handle jest identyczny jak w bazie, więc nie ma go w zmianach
    expect(plan.action === 'update' && Object.keys(plan.changes)).toEqual(['notes']);
  });
});

describe('planRow - pusta komórka nie kasuje danych w bazie', () => {
  it('żadne pole opcjonalne nie jest nadpisywane wartością pustą', () => {
    const rows = [
      existing({
        handle: '@ola',
        email: 'ola@przyklad.pl',
        phone: '+48123456789',
        location: 'Kraków',
        status: 'wolna',
        notes: 'stara notatka',
      }),
    ];
    const plan = planRow(person({ handle: '@ola' }), 'artist', rows, 'update');
    expect(plan).toEqual({ action: 'update', id: 1, level: 'certain', reason: 'handle', changes: {} });
  });
});
