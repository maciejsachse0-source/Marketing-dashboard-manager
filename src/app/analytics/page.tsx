import { desc } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { AnalyticsShell } from '@/components/analytics/analytics-shell';
import { db, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const [posts, uploads] = await Promise.all([
    db.query.posts.findMany({ orderBy: desc(schema.posts.publishedAt), limit: 200 }),
    db.query.csvUploads.findMany({ orderBy: desc(schema.csvUploads.uploadedAt), limit: 50 }),
  ]);

  return (
    <PageShell
      title="Analityka"
      description="Wgrywaj CSV z eksportów Meta / TikTok / YouTube. Filtruj i sortuj posty."
    >
      <AnalyticsShell posts={posts} uploads={uploads} />
    </PageShell>
  );
}
