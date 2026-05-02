import 'dotenv/config';
import { createPost, updatePostMetrics } from '../src/server/actions/posts';

async function main() {
  console.log('[seed-faza2] adding sample posts');

  const post1 = await createPost({
    publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    platform: 'instagram',
    title: 'Krótki teaser — riff z refrenu',
    caption: 'Mały kawałek tego co was czeka.',
    hashtags: ['#muzyka', '#singiel'],
    campaignId: 1,
  });
  await updatePostMetrics(post1.id, {
    reach: 8420,
    impressions: 11200,
    engagementRate: 4.2,
    completionRate: 58,
    saves: 142,
    shares: 34,
    comments: 28,
    followersGained: 47,
  });

  const post2 = await createPost({
    publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    platform: 'tiktok',
    title: 'Studio chaos — zwiastun',
    caption: 'POV: pierwszy raz słyszysz "Świt"',
    hashtags: ['#fyp', '#muzykaPL'],
    campaignId: 1,
  });
  await updatePostMetrics(post2.id, {
    reach: 23100,
    impressions: 31500,
    engagementRate: 6.8,
    completionRate: 71,
    saves: 412,
    shares: 89,
    comments: 67,
    followersGained: 124,
  });

  const post3 = await createPost({
    publishedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    platform: 'instagram',
    title: 'Zapowiedź daty premiery',
    caption: '26 maja. Save the date.',
    campaignId: 1,
  });
  await updatePostMetrics(post3.id, {
    reach: 5240,
    engagementRate: 1.8,
    completionRate: 41,
    saves: 12,
    shares: 4,
    comments: 8,
    followersGained: 9,
  });

  console.log('[seed-faza2] done — 3 posts');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
