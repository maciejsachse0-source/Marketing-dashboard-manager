import { describe, expect, it } from 'vitest';
import { detectCsvSource, parseCsvBuffer } from './csv-parser';
import { isLikelyMatch, normalizeRow } from './csv-mappers';

/** Wczytywanie statystyk z CSV: rozpoznanie źródła, mapowanie wiersza, dopasowanie
 *  do posta już zapisanego. Funkcje czyste, żadnego dotknięcia bazy. */
describe('detectCsvSource - rozpoznanie źródła po nagłówkach', () => {
  it('trafia w Meta, TikToka i YouTube, a przy braku wskazówek oddaje null', () => {
    expect(detectCsvSource('Post ID,Reach,Permalink\n1,10,https://x')).toBe('meta');
    expect(detectCsvSource('Video views,Total play time\n10,5')).toBe('tiktok');
    expect(detectCsvSource('Content,Watch time (hours),Subscribers\nabc,2,3')).toBe('youtube');
    expect(detectCsvSource('a,b\n1,2')).toBeNull();
  });
});

describe('parseCsvBuffer - nagłówki i puste wiersze', () => {
  it('wiersze wracają jako obiekty, puste linie wypadają, liczby są liczbami', () => {
    const rows = parseCsvBuffer('Title,Reach\nAla,120\n\nOla,7\n');
    expect(rows).toEqual([
      { Title: 'Ala', Reach: 120 },
      { Title: 'Ola', Reach: 7 },
    ]);
  });
});

describe('normalizeRow - wiersz statystyk na wspólny kształt', () => {
  it('Meta bez własnego wskaźnika liczy zaangażowanie z zasięgu', () => {
    const post = normalizeRow('meta', {
      Title: 'Kulisy nagrania',
      Posted: '2026-06-01T10:00:00Z',
      Reach: '1 000',
      Reactions: 80,
      Comments: 15,
      Shares: 5,
    });
    expect(post).toMatchObject({ platform: 'facebook', reach: 1000, engagementRate: 10 });
    expect(post?.publishedAt.toISOString()).toBe('2026-06-01T10:00:00.000Z');
  });

  it('permalink z Instagrama zmienia platformę wiersza Meta', () => {
    const post = normalizeRow('meta', {
      Title: 'Rolka',
      Posted: '2026-06-01T10:00:00Z',
      Permalink: 'https://www.instagram.com/p/abc/',
    });
    expect(post?.platform).toBe('instagram');
  });

  it('TikTok liczy ukończenie z czasu oglądania i długości filmu', () => {
    const post = normalizeRow('tiktok', {
      'Video title': 'Skok',
      Posted: '2026-06-02T09:00:00Z',
      'Video views': 200,
      'Like count': 20,
      'Average watch time': 15,
      'Video duration': 30,
    });
    expect(post).toMatchObject({ platform: 'tiktok', completionRate: 50, engagementRate: 10 });
  });

  it('wiersz bez tytułu albo bez daty jest odrzucany, podsumowanie YouTube też', () => {
    expect(normalizeRow('meta', { Title: 'Bez daty' })).toBeNull();
    expect(normalizeRow('youtube', { Content: 'Total', Views: 100 })).toBeNull();
  });
});

describe('isLikelyMatch - czy to ten sam post', () => {
  const base = {
    title: 'Kulisy nagrania w studiu',
    platform: 'tiktok' as const,
    publishedAt: new Date('2026-06-01T10:00:00Z'),
  };

  it('ten sam tytuł i czas w granicy godziny to trafienie', () => {
    expect(isLikelyMatch({ ...base, publishedAt: new Date('2026-06-01T10:30:00Z') }, base)).toBe(true);
  });

  it('inna platforma, odstęp ponad godzinę i inny tytuł to brak trafienia', () => {
    expect(isLikelyMatch({ ...base, platform: 'youtube' }, base)).toBe(false);
    expect(isLikelyMatch({ ...base, publishedAt: new Date('2026-06-01T12:00:00Z') }, base)).toBe(false);
    expect(isLikelyMatch({ ...base, title: 'Zupełnie inny materiał' }, base)).toBe(false);
  });
});
