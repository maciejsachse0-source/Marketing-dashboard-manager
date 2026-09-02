import { join, sep } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  getArtistFolderRoot,
  getProductionFolderRoot,
  getStagePath,
  resolveSafeStagePath,
} from './production-work-folder';

/**
 * Ścieżki folderu roboczego produkcji: nazwa czyszczona z tego, czego system
 * plików nie przyjmie, plus zabezpieczenie przed wyjściem poza folder
 * produkcji (Z13). Korzeń podmieniony na katalog testowy, nic nie jest
 * tworzone na dysku.
 */
const ROOT = join('/tmp', 'mc-test-root');

beforeAll(() => {
  process.env.MARKETING_CONTENT_ROOT = ROOT;
});

describe('nazwa folderu', () => {
  it('znaki nielegalne w Windowsie schodzą do myślnika, polskie zostają', () => {
    expect(getArtistFolderRoot('Zoś/ka: "Test"')).toBe(join(ROOT, 'Zoś-ka- -Test-'));
  });

  it('pusta nazwa nie daje pustego segmentu ścieżki', () => {
    expect(getArtistFolderRoot('   ')).toBe(join(ROOT, 'unnamed'));
  });
});

describe('ścieżka etapu', () => {
  it('etap siada w ramce swojego okresu pod folderem produkcji', () => {
    expect(getStagePath('Ala', 'Klip', 'obrobka')).toBe(join(ROOT, 'Ala', 'Klip', 'T2', 'obrobka'));
    expect(getStagePath('Ala', 'Klip', 'publikacja')).toBe(
      join(ROOT, 'Ala', 'Klip', 'T3', 'publikacja'),
    );
  });
});

describe('resolveSafeStagePath - zapora na wyjście z folderu', () => {
  it('ścieżka etapu zostaje w folderze produkcji nawet dla nazwy z ../', () => {
    const resolved = resolveSafeStagePath('Ala', '../../etc', 'nagrywanie');
    expect(resolved.startsWith(getProductionFolderRoot('Ala', '../../etc'))).toBe(true);
    expect(resolved.split(sep)).not.toContain('..');
  });
});
