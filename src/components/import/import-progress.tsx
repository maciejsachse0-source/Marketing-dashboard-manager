'use client';

/** Krok 6: licznik faktycznie zapisanych paczek (plan/04 sekcja 6 i 7). */
export function ImportProgress({ done, total }: { done: number; total: number }) {
  const procent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-4">
      <p data-testid="import-postep" className="text-sm">
        Zapisuję, paczka {done} z {total}
      </p>
      <div
        role="progressbar"
        aria-label="Postęp zapisu"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary transition-[width]" style={{ width: `${procent}%` }} />
      </div>
    </div>
  );
}
