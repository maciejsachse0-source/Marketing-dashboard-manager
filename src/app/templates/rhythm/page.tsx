import { PageShell } from '@/components/page-shell';
import { loadRhythm, isoDayLabel } from '@/lib/rhythm';
import { PlatformPills } from '@/components/platforms-pills';

export const dynamic = 'force-dynamic';

export default async function RhythmPage() {
  const rhythm = loadRhythm();

  // Group slots by day
  const byDay = new Map<number, typeof rhythm.slots>();
  for (let day = 1; day <= 7; day++) byDay.set(day, []);
  for (const slot of rhythm.slots) {
    byDay.get(slot.dayOfWeek)?.push(slot);
  }
  for (const arr of byDay.values()) {
    arr.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  }

  const totalPerWeek = rhythm.slots.length;
  const activeDays = Array.from(byDay.entries()).filter(([, slots]) => slots.length > 0).length;

  return (
    <PageShell
      title="Rytm tygodniowy"
      description={`${totalPerWeek} postów / tydzień · ${activeDays} aktywnych dni`}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
            const slots = byDay.get(day) ?? [];
            const isOff = slots.length === 0;
            return (
              <div
                key={day}
                className={`rounded-lg border p-3 ${
                  isOff
                    ? 'border-dashed border-border bg-muted/10'
                    : 'border-border bg-card'
                }`}
              >
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                  {isoDayLabel(day)}
                </div>
                {isOff ? (
                  <p className="text-[10px] text-muted-foreground/60 italic">wolne</p>
                ) : (
                  <ul className="space-y-1.5">
                    {slots.map((slot, idx) => (
                      <li key={idx} className="text-xs">
                        <div className="font-mono tabular-nums text-foreground">
                          {String(slot.hour).padStart(2, '0')}:
                          {String(slot.minute).padStart(2, '0')}
                        </div>
                        <div className="text-muted-foreground truncate" title={slot.postType}>
                          {slot.postType}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <section>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3 font-medium">
            Lista wszystkich slotów
          </h2>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Dzień</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Godzina</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Typ posta</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Platformy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rhythm.slots.map((slot, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{isoDayLabel(slot.dayOfWeek)}</td>
                    <td className="px-4 py-2 font-mono tabular-nums">
                      {String(slot.hour).padStart(2, '0')}:{String(slot.minute).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-2">{slot.postType}</td>
                    <td className="px-4 py-2">
                      <PlatformPills platforms={slot.platforms} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Edycja: <code className="font-mono">data/templates/rhythm.json</code> — zmień, refresh
          stronę.
        </p>
      </div>
    </PageShell>
  );
}
