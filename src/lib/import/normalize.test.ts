import { describe, it, expect } from 'vitest';
import { normalizeRow } from './normalize';

const artist = { role: 'artist' as const };
const videographer = { role: 'videographer' as const };

function ok(raw: Record<string, unknown>, role: 'artist' | 'videographer' = 'artist') {
  const result = normalizeRow(raw, role);
  if (result.kind !== 'ok') throw new Error(`oczekiwano ok, jest ${result.kind}: ${JSON.stringify(result)}`);
  return result.person;
}

function errors(raw: Record<string, unknown>, role: 'artist' | 'videographer' = 'artist') {
  const result = normalizeRow(raw, role);
  if (result.kind !== 'error') throw new Error(`oczekiwano error, jest ${result.kind}`);
  return result.errors;
}

describe('normalizeRow - nazwa', () => {
  it('przycina spacje wokół nazwy', () => {
    expect(ok({ name: '  Ola Nowak  ' }).name).toBe('Ola Nowak');
  });

  it('zachowuje polskie znaki w nazwie', () => {
    expect(ok({ name: 'Zażółć Gęślą Jaźń' }).name).toBe('Zażółć Gęślą Jaźń');
  });

  it('wiersz z samą nazwą jest poprawny, reszta pól to null', () => {
    const person = ok({ name: 'Sam Nazwa' });
    expect(person).toEqual({
      name: 'Sam Nazwa',
      handle: null,
      email: null,
      phone: null,
      location: null,
      status: null,
      notes: null,
    });
  });

  it('brak nazwy przy innych wypełnionych polach to błąd', () => {
    expect(errors({ name: '   ', handle: '@ktos' })).toContain('brak nazwy');
  });
});

describe('normalizeRow - wiersz pusty', () => {
  it('wiersz całkowicie pusty jest pomijany bez błędu', () => {
    expect(normalizeRow({ name: '', handle: '   ', email: null, phone: undefined }, 'artist').kind).toBe('empty');
  });

  it('wiersz bez żadnych kluczy też jest pomijany', () => {
    expect(normalizeRow({}, 'videographer').kind).toBe('empty');
  });
});

describe('normalizeRow - handle', () => {
  it('pełny URL z instagrama sprowadza do handle', () => {
    expect(ok({ name: 'A', handle: 'https://instagram.com/Kowalska_Foto/' }).handle).toBe('@kowalska_foto');
  });

  it('URL z www i http też', () => {
    expect(ok({ name: 'A', handle: 'http://www.instagram.com/NocnaZmiana' }).handle).toBe('@nocnazmiana');
  });

  it('handle bez małpy dostaje dokładnie jedną małpę', () => {
    expect(ok({ name: 'A', handle: 'lampa_studio' }).handle).toBe('@lampa_studio');
  });

  it('handle z podwójną małpą ma dokładnie jedną', () => {
    expect(ok({ name: 'A', handle: '@@lampa' }).handle).toBe('@lampa');
  });

  it('sama małpa to null, nie pusty łańcuch', () => {
    expect(ok({ name: 'A', handle: '@' }).handle).toBeNull();
  });
});

describe('normalizeRow - email', () => {
  it('wielkie litery schodzą do małych', () => {
    expect(ok({ name: 'A', email: '  Kontakt@Przyklad.PL ' }).email).toBe('kontakt@przyklad.pl');
  });

  it('email bez małpy to błąd', () => {
    expect(errors({ name: 'A', email: 'kontakt.przyklad.pl' })).toContain('zły email');
  });
});

describe('normalizeRow - telefon', () => {
  it.each([
    ['+48 123 456 789', '+48123456789'],
    ['0048 123 456 789', '+48123456789'],
    ['123-456-789', '+48123456789'],
    ['(123) 456-789', '+48123456789'],
  ])('zapis %s daje %s', (input, expected) => {
    expect(ok({ name: 'A', phone: input }).phone).toBe(expected);
  });

  it('za krótki numer to błąd', () => {
    expect(errors({ name: 'A', phone: '12 34 56' })).toContain('zły telefon');
  });
});

describe('normalizeRow - lokalizacja', () => {
  it('pierwsza litera duża, reszta bez zmian', () => {
    expect(ok({ name: 'A', location: '  wARSZAWA ' }).location).toBe('WARSZAWA');
  });

  it.each(['tricity', 'trojmiasto', 'Trójmiasto', 'TRICITY'])('synonim %s daje Trójmiasto', (input) => {
    expect(ok({ name: 'A', location: input }).location).toBe('Trójmiasto');
  });
});

describe('normalizeRow - status i notatki', () => {
  it('status kamerzysty zostaje przycięty i zachowany', () => {
    expect(ok({ name: 'A', status: '  wolny od marca ' }, videographer.role).status).toBe('wolny od marca');
  });

  it('status dla roli twórcy jest ignorowany', () => {
    expect(ok({ name: 'A', status: 'cokolwiek' }, artist.role).status).toBeNull();
  });

  it('notatki są przycinane', () => {
    expect(ok({ name: 'A', notes: ' pracuje wieczorami ' }).notes).toBe('pracuje wieczorami');
  });
});

describe('normalizeRow - pusta komórka nigdy nie daje pustego łańcucha', () => {
  it('wszystkie pola opcjonalne puste dają null', () => {
    const person = ok({ name: 'A', handle: '  ', email: '', phone: '   ', location: '', status: '  ', notes: '' }, 'videographer');
    expect(person.handle).toBeNull();
    expect(person.email).toBeNull();
    expect(person.phone).toBeNull();
    expect(person.location).toBeNull();
    expect(person.status).toBeNull();
    expect(person.notes).toBeNull();
    expect(Object.values(person).filter((v) => v === '')).toHaveLength(0);
  });
});

describe('normalizeRow - komórki nietekstowe z arkusza', () => {
  it('liczba w telefonie i data w notatkach schodzą do tekstu', () => {
    const person = ok({ name: 'A', phone: 123456789, notes: 42 });
    expect(person.phone).toBe('+48123456789');
    expect(person.notes).toBe('42');
  });

  it('obiekt w komórce to błąd wiersza, nie wyjątek', () => {
    expect(errors({ name: 'A', handle: { text: 'x' } })).toContain('nieobsługiwana zawartość komórki');
  });
});
