'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type PreviewRow =
  | {
      action: 'create';
      title: string;
      platform: string;
      publishedAt: string;
      reach?: number;
      engagementRate?: number;
    }
  | {
      action: 'update';
      title: string;
      platform: string;
      publishedAt: string;
      matchedPostId: number;
      changes: Record<string, string>;
    }
  | { action: 'skip'; reason: string; raw?: string };

type DryRun = {
  dryRun: true;
  source: string;
  rowCount: number;
  created: number;
  updated: number;
  skipped: number;
  preview: PreviewRow[];
};

export function CsvDropzone() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dry, setDry] = useState<DryRun | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const preview = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/csv?dryRun=true', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? `HTTP ${res.status}`;
        setError(msg);
        toast.error('Nie udało się przeanalizować CSV', { description: msg });
        return;
      }
      setDry(json);
      setPendingFile(file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error('Błąd analizy', { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!pendingFile) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', pendingFile);
      const res = await fetch('/api/csv', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? `HTTP ${res.status}`;
        toast.error('Nie wgrano CSV', { description: msg });
        return;
      }
      const summary = `${json.created} nowych, ${json.updated} zaktualizowanych${json.skipped ? `, ${json.skipped} pominiętych` : ''}`;
      toast.success(`CSV wgrany (${json.source})`, { description: summary });
      setDry(null);
      setPendingFile(null);
      router.refresh();
    } catch (e) {
      toast.error('Błąd zapisu', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setDry(null);
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Wgraj plik .csv');
      return;
    }
    preview(f);
  };

  return (
    <>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed transition p-8 text-center ${
          dragActive ? 'border-foreground bg-muted/30' : 'border-border bg-card'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="space-y-3">
          <div className="text-sm">
            {busy && !dry ? (
              <span className="text-muted-foreground">Analizowanie…</span>
            ) : (
              <>
                <div className="font-medium">Przeciągnij CSV tutaj lub kliknij</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Eksporty z Meta Business Suite, TikTok Analytics, YouTube Studio
                </div>
              </>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            Wybierz plik
          </Button>
        </div>
        {error ? <p className="mt-3 text-xs text-rose-400 text-left">⚠ {error}</p> : null}
      </div>

      <Dialog open={!!dry} onOpenChange={(open) => (!open ? cancel() : null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Podgląd importu</span>
              {dry ? (
                <span className="text-xs font-normal text-muted-foreground">
                  {dry.source} · {dry.rowCount} wierszy
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {dry ? (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-3 gap-2">
                <SummaryCard tone="emerald" label="Nowe posty" value={dry.created} />
                <SummaryCard tone="sky" label="Update metryk" value={dry.updated} />
                <SummaryCard tone="zinc" label="Pominięte" value={dry.skipped} />
              </div>

              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr className="text-left">
                      <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-20">Akcja</th>
                      <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tytuł / powód</th>
                      <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Detale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border max-h-72 overflow-y-auto">
                    {dry.preview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <ActionPill action={row.action} />
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {row.action === 'skip' ? (
                            <span className="text-muted-foreground">{row.reason}</span>
                          ) : (
                            <div>
                              <div className="font-medium truncate max-w-xs">{row.title}</div>
                              <div className="text-muted-foreground text-[10px]">
                                [{row.platform}] {new Date(row.publishedAt).toLocaleDateString('pl-PL', { dateStyle: 'short' })}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {row.action === 'create' ? (
                            <span className="text-muted-foreground tabular-nums">
                              {row.reach ? `reach ${row.reach.toLocaleString('pl-PL')}` : ''}
                              {row.engagementRate ? ` · ER ${row.engagementRate}%` : ''}
                            </span>
                          ) : row.action === 'update' ? (
                            <span className="text-muted-foreground tabular-nums">
                              #{row.matchedPostId} · {Object.entries(row.changes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={cancel} disabled={busy}>
              Anuluj
            </Button>
            <Button onClick={commit} disabled={busy || !dry || (dry.created === 0 && dry.updated === 0)}>
              {busy ? 'Zapisywanie…' : `Zatwierdź (${(dry?.created ?? 0) + (dry?.updated ?? 0)})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryCard({
  tone,
  label,
  value,
}: {
  tone: 'emerald' | 'sky' | 'zinc';
  label: string;
  value: number;
}) {
  const colors = {
    emerald: 'border-emerald-500/30 text-emerald-300',
    sky: 'border-sky-500/30 text-sky-300',
    zinc: 'border-border text-muted-foreground',
  };
  return (
    <div className={`rounded-md border bg-card px-3 py-2 ${colors[tone]}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function ActionPill({ action }: { action: 'create' | 'update' | 'skip' }) {
  const map = {
    create: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    update: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    skip: 'bg-zinc-500/15 text-zinc-400 border-border',
  };
  const labels = { create: 'nowy', update: 'update', skip: 'pomiń' };
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded border uppercase tracking-wider ${map[action]}`}>
      {labels[action]}
    </span>
  );
}
