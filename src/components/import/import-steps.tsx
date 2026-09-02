const STEP_LABELS = ['Plik', 'Arkusz i rola', 'Mapowanie', 'Suchy przebieg'];

/** Pasek kroków importu (plan/04 sekcja 2). Sam wskaźnik, bez nawigacji. */
export function ImportSteps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {STEP_LABELS.map((label, index) => {
        const numer = index + 1;
        const aktywny = numer === current;
        return (
          <li
            key={label}
            aria-current={aktywny ? 'step' : undefined}
            className={`rounded-full border px-3 py-1 ${
              aktywny
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground'
            }`}
          >
            {numer}. {label}
          </li>
        );
      })}
    </ol>
  );
}
