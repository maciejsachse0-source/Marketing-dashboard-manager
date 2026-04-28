import Link from 'next/link';
import { CalendarDays, ChartGantt } from 'lucide-react';

export function ViewToggle({ view }: { view: 'week' | 'gantt' }) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted border border-border">
      <Link
        href="/calendar"
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition ${
          view === 'week'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <CalendarDays className="w-3.5 h-3.5" strokeWidth={2} />
        Tydzień
      </Link>
      <Link
        href="/calendar?view=gantt"
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition ${
          view === 'gantt'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <ChartGantt className="w-3.5 h-3.5" strokeWidth={2} />
        Gantt
      </Link>
    </div>
  );
}
