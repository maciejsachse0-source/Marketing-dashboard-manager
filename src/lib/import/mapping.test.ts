import { describe, expect, it } from 'vitest';
import { autoMap, mappingConflicts, normalizeHeader, toRawRow } from './mapping';

/**
 * Mapowanie kolumn arkusza na pola osoby (plan/06 sekcja 3, wiersz
 * „Mapowanie kolumn"). Cztery wymagane scenariusze: dopasowanie po aliasie,
 * nagłówek z polskimi znakami, kolizja dwóch kolumn, kolumna nierozpoznana.
 */
describe('normalizeHeader - sprowadzenie nagłówka do klucza', () => {
  it('zdejmuje diakrytyki, spacje i wielkość liter', () => {
    expect(normalizeHeader('  Imię i Nazwisko ')).toBe('imieinazwisko');
    expect(normalizeHeader('Lokalizacja')).toBe('lokalizacja');
    expect(normalizeHeader('Komórka')).toBe('komorka');
  });
});

describe('autoMap - propozycja mapowania', () => {
  it('dopasowuje po aliasie, nie tylko po dokładnej nazwie pola', () => {
    expect(autoMap(['Insta', 'Mail', 'Tel'], 'videographer')).toEqual([
      'handle',
      'email',
      'phone',
    ]);
  });

  it('nagłówek z polskimi znakami trafia w to samo pole co bez nich', () => {
    expect(autoMap(['Imię'], 'artist')).toEqual(['name']);
    expect(autoMap(['Komórka'], 'artist')).toEqual(['phone']);
  });

  it('kolizja dwóch kolumn o tym samym polu: druga zostaje pominięta', () => {
    expect(autoMap(['Imię', 'Nazwa'], 'artist')).toEqual(['name', null]);
  });

  it('kolumna nierozpoznana dostaje null, nie zgaduje pola', () => {
    expect(autoMap(['Ulubiony kolor'], 'artist')).toEqual([null]);
  });

  it('status nie jest proponowany dla roli twórcy, bo tabela go nie ma', () => {
    expect(autoMap(['Status'], 'artist')).toEqual([null]);
    expect(autoMap(['Status'], 'videographer')).toEqual(['status']);
  });
});

describe('mappingConflicts - blokada przejścia dalej', () => {
  it('pole zmapowane dwa razy jest zgłoszone, zmapowane raz nie', () => {
    expect(mappingConflicts(['name', 'name', 'email'])).toEqual(['name']);
    expect(mappingConflicts(['name', 'email', null, null])).toEqual([]);
  });
});

describe('toRawRow - komórki w kształcie dla normalizeRow', () => {
  it('bierze tylko zmapowane kolumny, brakująca komórka to null', () => {
    expect(toRawRow(['Ala', 'x@y.pl'], ['name', 'email', 'phone'])).toEqual({
      name: 'Ala',
      email: 'x@y.pl',
      phone: null,
    });
  });
});
