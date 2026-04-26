'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/copy-button';
import { MarkdownView } from './markdown-view';

export type BriefRow = {
  filename: string;
  path: string;
  modifiedAt: string;
  sizeBytes: number;
  kind: 'brief' | 'wrap';
};

export function BriefsShell({
  rows,
  contentByFilename,
}: {
  rows: BriefRow[];
  contentByFilename: Record<string, string>;
}) {
  const [filter, setFilter] = useState<'all' | 'brief' | 'wrap'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<BriefRow | null>(null);

  const filtered = useMemo(() => {
    const byKind = filter === 'all' ? rows : rows.filter((r) => r.kind === filter);
    const q = search.trim().toLowerCase();
    if (!q) return byKind;
    return byKind.filter((r) => {
      if (r.filename.toLowerCase().includes(q)) return true;
      const content = (contentByFilename[r.filename] ?? '').toLowerCase();
      return content.includes(q);
    });
  }, [rows, filter, search, contentByFilename]);

  const briefCount = rows.filter((r) => r.kind === 'brief').length;
  const wrapCount = rows.filter((r) => r.kind === 'wrap').length;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po nazwie pliku lub treści..."
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded border transition ${
              filter === 'all'
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground/40'
            }`}
          >
            Wszystko ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('brief')}
            className={`px-2.5 py-1 rounded border transition ${
              filter === 'brief'
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground/40'
            }`}
          >
            Briefy ({briefCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('wrap')}
            className={`px-2.5 py-1 rounded border transition ${
              filter === 'wrap'
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground/40'
            }`}
          >
            Wrapy ({wrapCount})
          </button>
        </div>
        <div className="ml-auto flex gap-2">
          <Link
            href="/agents/content-brief"
            className="text-xs px-3 py-1.5 rounded border border-border hover:border-foreground/40 transition"
          >
            + Brief (przez content-brief)
          </Link>
          <Link
            href="/agents/weekly-wrap"
            className="text-xs px-3 py-1.5 rounded border border-border hover:border-foreground/40 transition"
          >
            + Wrap (przez weekly-wrap)
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? 'Brak briefów ani wrapów. Wygeneruj pierwszy przez content-brief lub weekly-wrap.'
            : 'Żaden plik nie pasuje do filtra.'}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Typ</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Plik</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Zmieniony</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground text-right">Rozmiar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => (
                <tr
                  key={row.filename}
                  className="hover:bg-muted/20 transition cursor-pointer"
                  onClick={() => setSelected(row)}
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${
                        row.kind === 'wrap'
                          ? 'bg-sky-100 text-sky-800 border-sky-300'
                          : 'bg-violet-100 text-violet-800 border-violet-300'
                      }`}
                    >
                      {row.kind}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.filename}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">
                    {new Date(row.modifiedAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                    {(row.sizeBytes / 1024).toFixed(1)} KB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 pr-8">
              <span className="font-mono text-sm">{selected?.filename}</span>
              {selected ? (
                <CopyButton text={contentByFilename[selected.filename] ?? ''} label="Skopiuj markdown" />
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="border-t border-border pt-3">
              <MarkdownView content={contentByFilename[selected.filename] ?? '_(nie udało się odczytać)_'} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
