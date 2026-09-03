'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Camera, Check, ChevronDown, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { updateProduction } from '@/server/actions/productions';
import { Button } from '@/components/ui/button';

export type VideographerOption = {
  id: number;
  name: string;
  contact: string | null;
  hourlyRate: number | null;
};

export function VideographerPicker({
  productionId,
  currentVideographerId,
  videographers,
}: {
  productionId: number;
  currentVideographerId: number | null;
  videographers: VideographerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = videographers.find((v) => v.id === currentVideographerId) ?? null;

  const assign = (videographerId: number | null) => {
    if (videographerId === currentVideographerId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      try {
        await updateProduction(productionId, { videographerId });
        toast.success(
          videographerId
            ? `Przypisano kamerzystę: ${videographers.find((v) => v.id === videographerId)?.name ?? ''}`
            : 'Usunięto przypisanie kamerzysty',
        );
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error('Nie udało się zapisać', { description: msg });
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 label-micro-wide text-muted-foreground font-medium">
          <Camera className="size-3.5" strokeWidth={1.75} />
          Kamerzysta
        </span>

        {current ? (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--accent-blue-tint)] text-[var(--accent-blue)] text-xs font-medium">
            <span>{current.name}</span>
            {current.hourlyRate ? (
              <span className="opacity-70 tabular-nums">{current.hourlyRate}zł/h</span>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => assign(null)}
              disabled={pending}
              title="Usuń przypisanie"
              className="h-auto border-0 p-0 font-normal hover:bg-transparent hover:text-inherit opacity-60 hover:opacity-100 transition disabled:opacity-30"
            >
              <X className="size-3" strokeWidth={2.5} />
            </Button>
          </div>
        ) : (
          <span className="text-xs italic text-muted-foreground">nie przypisano</span>
        )}

        <Button
          variant="ghost"
          onClick={() => setOpen((o) => !o)}
          disabled={pending}
          className="h-auto hover:bg-transparent ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-[11px] font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground transition disabled:opacity-50"
        >
          {current ? (
            <>
              zmień
              <ChevronDown
                className={`size-3 transition ${open ? 'rotate-180' : ''}`}
                strokeWidth={2}
              />
            </>
          ) : (
            <>
              <Plus className="size-3" strokeWidth={2.5} />
              przypisz
            </>
          )}
        </Button>
      </div>

      {open ? (
        videographers.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            Brak kamerzystów w bazie.{' '}
            <Link
              href="/videographers"
              className="text-[var(--accent-blue)] hover:underline font-medium"
            >
              Dodaj w /videographers
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {videographers.map((v) => {
                const active = v.id === currentVideographerId;
                return (
                  <Button
                    variant="ghost"
                    key={v.id}
                    onClick={() => assign(v.id)}
                    disabled={pending}
                    className={`h-auto font-normal bg-clip-border hover:bg-transparent inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition disabled:opacity-50 ${
                      active
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                    }`}
                  >
                    {active ? <Check className="size-3" strokeWidth={2.5} /> : null}
                    <span>{v.name}</span>
                    {v.hourlyRate ? (
                      <span className="opacity-60 tabular-nums">{v.hourlyRate}zł/h</span>
                    ) : null}
                  </Button>
                );
              })}
            </div>
            <div className="text-[10px] text-muted-foreground/80">
              Brakuje? Dodaj w{' '}
              <Link
                href="/videographers"
                className="font-mono hover:text-foreground hover:underline"
              >
                /videographers
              </Link>
              .
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
