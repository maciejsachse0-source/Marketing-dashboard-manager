import { describe, expect, it } from 'vitest';
import {
  idSchema,
  isoDateSchema,
  labelSchema,
  markModeSchema,
  moveDirectionSchema,
  opaqueIdSchema,
  slugSchema,
  uploadedFileSchema,
} from './schemas';

/**
 * Prymitywy granicy zaufania (zasada Z13, issue F6-02). Test pilnuje, że
 * odrzucają to, co przychodzi z przeglądarki w złej formie — argument akcji
 * serwerowej jest wejściem od użytkownika, nie zaufaną wartością z typu.
 */
describe('prymitywy granicy zaufania', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('idSchema odrzuca %s', (zle) => {
    expect(idSchema.safeParse(zle).success).toBe(false);
  });

  it('idSchema przyjmuje dodatnią liczbę całkowitą', () => {
    expect(idSchema.parse(7)).toBe(7);
  });

  it.each(['', 'a'.repeat(201)])('opaqueIdSchema odrzuca długość %#', (zle) => {
    expect(opaqueIdSchema.safeParse(zle).success).toBe(false);
  });

  it.each(['../etc/passwd', 'a/b', 'Wielkie', '-start', 'kropka.json', ''])(
    'slugSchema odrzuca %s',
    (zle) => {
      expect(slugSchema.safeParse(zle).success).toBe(false);
    },
  );

  it('slugSchema przyjmuje slug z generatora', () => {
    expect(slugSchema.parse('standard-with-artist')).toBe('standard-with-artist');
  });

  it.each(['', 'x'.repeat(201)])('labelSchema odrzuca długość %#', (zle) => {
    expect(labelSchema.safeParse(zle).success).toBe(false);
  });

  it.each(['jutro', '', 'nie-data'])('isoDateSchema odrzuca %s', (zle) => {
    expect(isoDateSchema.safeParse(zle).success).toBe(false);
  });

  it('isoDateSchema przyjmuje ISO', () => {
    expect(isoDateSchema.parse('2026-09-03T10:00:00.000Z')).toBe('2026-09-03T10:00:00.000Z');
  });

  it('tryby są zamkniętymi listami', () => {
    expect(markModeSchema.safeParse('drop').success).toBe(false);
    expect(moveDirectionSchema.safeParse('left').success).toBe(false);
    expect(markModeSchema.parse('mark')).toBe('mark');
  });

  it('uploadedFileSchema pilnuje nazwy i limitu rozmiaru', () => {
    const schemat = uploadedFileSchema(1024);
    expect(schemat.safeParse({ name: 'a.xlsx', size: 1024 }).success).toBe(true);
    expect(schemat.safeParse({ name: 'a.xlsx', size: 1025 }).success).toBe(false);
    expect(schemat.safeParse({ name: '', size: 10 }).success).toBe(false);
    expect(schemat.safeParse({ name: 'a.xlsx', size: 0 }).success).toBe(false);
  });
});
