'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CsvDropzone } from './csv-dropzone';
import { PostDialog } from './post-dialog';
import { PlatformPill } from '@/components/platforms-pills';
import type { Post, CsvUpload, Platform } from '../../../drizzle/schema';
import { PLATFORMS } from '../../../drizzle/schema';

type SortKey = 'date' | 'reach' | 'er' | 'completion';

export function AnalyticsShell({
  posts,
  uploads,
}: {
  posts: Post[];
  uploads: CsvUpload[];
}) {
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');

  const sorted = useMemo(() => {
    const filtered = platformFilter === 'all' ? posts : posts.filter((p) => p.platform === platformFilter);
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortKey === 'date') return b.publishedAt.getTime() - a.publishedAt.getTime();
      if (sortKey === 'reach') return (b.reach ?? -1) - (a.reach ?? -1);
      if (sortKey === 'er') return (b.engagementRate ?? -1) - (a.engagementRate ?? -1);
      if (sortKey === 'completion') return (b.completionRate ?? -1) - (a.completionRate ?? -1);
      return 0;
    });
    return arr;
  }, [posts, sortKey, platformFilter]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <CsvDropzone />
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Wgrane CSV ({uploads.length})
            </span>
          </div>
          <ul className="divide-y divide-border max-h-48 overflow-y-auto">
            {uploads.length === 0 ? (
              <li className="px-4 py-3 text-xs text-muted-foreground">Brak wgranych raportów.</li>
            ) : (
              uploads.map((u) => (
                <li key={u.id} className="px-4 py-2 text-xs flex items-center gap-2">
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {u.uploadedAt.toLocaleDateString('pl-PL', { dateStyle: 'short' })}
                  </span>
                  <span className="font-mono truncate flex-1">{u.filename}</span>
                  <span className="text-muted-foreground shrink-0">
                    {u.source} · {u.rowCount}w
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Posty ({sorted.length})
          </h2>
          <div className="flex items-center gap-1 ml-2 text-xs">
            <span className="text-muted-foreground">Sort:</span>
            {(
              [
                ['date', 'data'],
                ['reach', 'reach'],
                ['er', 'ER'],
                ['completion', 'completion'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSortKey(k)}
                className={`px-2 py-1 rounded border transition ${
                  sortKey === k
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-2 text-xs">
            <span className="text-muted-foreground">Platforma:</span>
            <button
              type="button"
              onClick={() => setPlatformFilter('all')}
              className={`px-2 py-1 rounded border transition ${
                platformFilter === 'all'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40'
              }`}
            >
              wszystko
            </button>
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatformFilter(p)}
                className={`px-2 py-1 rounded border transition ${
                  platformFilter === p
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/40'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setPostDialogOpen(true)}>
            + Post manualnie
          </Button>
          <Link
            href="/agents/viral-analyzer"
            className="text-xs px-3 py-1.5 rounded border border-border hover:border-foreground/40 transition"
          >
            Otwórz viral-analyzera
          </Link>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {posts.length === 0
              ? 'Brak postów. Wgraj CSV powyżej albo dodaj manualnie.'
              : 'Żaden post nie pasuje do filtrów.'}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Tytuł</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Plat.</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Data</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium text-right">Reach</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium text-right">ER</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium text-right">Compl</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium text-right">Saves</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium text-right">F+</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition">
                    <td className="px-3 py-2 truncate max-w-xs" title={p.title}>{p.title}</td>
                    <td className="px-3 py-2"><PlatformPill platform={p.platform} /></td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {p.publishedAt.toLocaleDateString('pl-PL', { dateStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.reach?.toLocaleString('pl-PL') ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.engagementRate ? `${p.engagementRate}%` : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.completionRate ? `${p.completionRate}%` : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.saves?.toLocaleString('pl-PL') ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.followersGained ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PostDialog open={postDialogOpen} onOpenChange={setPostDialogOpen} />
    </div>
  );
}
