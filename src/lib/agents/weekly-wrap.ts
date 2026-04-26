import 'server-only';
import { desc, gte } from 'drizzle-orm';
import { db, schema } from '../db';
import { getUpcomingCalendar, getActiveCampaigns } from '../context';
import type { AgentDef } from './types';

export const weeklyWrap: AgentDef = {
  slug: 'weekly-wrap',
  name: 'Weekly Wrap',
  description: 'Cotygodniowy raport: co było, co działa, co przed nami, co wymaga decyzji.',
  sidePanel: 'wrap-history',
  systemPrompt: `Jesteś agentem od cotygodniowych podsumowań. Raz w tygodniu sprzątasz w głowie użytkownika — pokazujesz co zrobione, co działa, co czeka, co wymaga decyzji.

Struktura raportu (5 sekcji):

1. CO BYŁO (poprzedni tydzień):
   - Opublikowane (z metrykami z bazy)
   - Nagrane ale nieopublikowane
   - Komunikacja (outreache wysłane / odpowiedzi / zaległe follow-upy)

2. CO ZADZIAŁAŁO / CO NIE:
   - Top wnioski tygodnia (3-5 punktów)
   - Co nie zadziałało (z konkretnymi liczbami)

3. CO PRZED NAMI (nadchodzący tydzień):
   - Kalendarz (z bazy)
   - Priorytety (3 punkty)
   - Trendy do wykorzystania (jeśli świeży raport z trend-scout)

4. CO WYMAGA DECYZJI:
   - Decyzje na ten tydzień (otwarte sprawy, zaległe odpowiedzi)
   - Deadline'y

5. INSIGHT / NOTATKA TRENERSKA:
   - 2-3 zdania luźnym tonem, syntetyczna obserwacja

Po zaakceptowaniu raportu zwróć blok JSON do zapisania:
\`\`\`json
{
  "isoWeek": "YYYY-Www",
  "markdown": "<pełny raport>",
  "filename": "wrap-YYYY-Www.md"
}
\`\`\`

Reguły:
- Konkretnie — liczby, daty, imiona
- Pokazuj priorytety
- Ostrzegaj o opóźnieniach
- Strzałkami ↑↓ rosnące/spadające trendy
- Bez bullshitu motywacyjnego — jeśli słabo, mów wprost
- Odpowiadaj po polsku`,
  contextLoader: async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPosts = await db.query.posts.findMany({
      where: gte(schema.posts.publishedAt, sevenDaysAgo),
      orderBy: desc(schema.posts.publishedAt),
      limit: 30,
    });
    const upcoming = await getUpcomingCalendar(7);
    const campaigns = await getActiveCampaigns();

    const postLines = recentPosts.map(
      (p) =>
        `- [${p.platform}] ${p.publishedAt.toISOString().slice(0, 10)} "${p.title}" | reach=${p.reach ?? '?'} ER=${p.engagementRate ?? '?'}%`,
    );
    const calLines = upcoming.map(
      (e) => `- [${e.type}] ${e.startsAt.toISOString()} | ${e.title} | status=${e.status}`,
    );
    const campLines = campaigns.map(
      (c) => `- "${c.name}" T-0 ${c.releaseAt.toISOString().slice(0, 10)} | faza=${c.phase}`,
    );

    return [
      `Aktualna data: ${new Date().toISOString()}`,
      `\nPosty z ostatnich 7 dni (${recentPosts.length}):\n${postLines.join('\n') || '(brak)'}`,
      `\nKalendarz na 7 dni do przodu (${upcoming.length}):\n${calLines.join('\n') || '(pusty)'}`,
      `\nAktywne kampanie (${campaigns.length}):\n${campLines.join('\n') || '(brak)'}`,
    ].join('\n');
  },
};
