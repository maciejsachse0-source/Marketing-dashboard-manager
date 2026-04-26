import 'dotenv/config';
import { getUpcomingCalendar, getAllArtists } from '../src/lib/context';

async function main() {
  const upcoming = await getUpcomingCalendar(14);
  const artists = await getAllArtists();

  console.log(`=== KALENDARZ (14 dni, ${upcoming.length} wpisów) ===`);
  for (const e of upcoming) {
    const start = e.startsAt.toISOString().slice(0, 16).replace('T', ' ');
    const end = e.endsAt.toISOString().slice(11, 16);
    const platforms = e.platforms ? ` | ${e.platforms.join(',')}` : '';
    const artist = e.artistId ? ` | artist#${e.artistId}` : '';
    console.log(`#${e.id} [${e.type}] ${start}–${end} | ${e.title} | ${e.status}${platforms}${artist}`);
  }
  console.log();
  console.log(`=== ARTYŚCI (${artists.length}) ===`);
  for (const a of artists) {
    console.log(`#${a.id} ${a.name}${a.handle ? ` (${a.handle})` : ''}`);
  }
  console.log();
  console.log('NOW:', new Date().toISOString());
}

main().then(() => process.exit(0));
