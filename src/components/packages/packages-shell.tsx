'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PlatformPills, StatusPill } from '@/components/platforms-pills';
import { PackageModal } from './package-modal';
import type { Package, PackageStatus, Platform } from '../../../drizzle/schema';
import { PACKAGE_STATUSES, PLATFORMS } from '../../../drizzle/schema';

export function PackagesShell({ packages }: { packages: Package[] }) {
  const [selected, setSelected] = useState<Package | null>(null);
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PackageStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');

  const filtered = useMemo(() => {
    return packages.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (platformFilter !== 'all' && !p.platforms.includes(platformFilter)) return false;
      return true;
    });
  }, [packages, statusFilter, platformFilter]);

  const onOpen = (p: Package) => {
    setSelected(p);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterGroup
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as PackageStatus | 'all')}
          options={[{ value: 'all', label: 'wszystko' }, ...PACKAGE_STATUSES.map((s) => ({ value: s, label: s }))]}
        />
        <FilterGroup
          label="Platforma"
          value={platformFilter}
          onChange={(v) => setPlatformFilter(v as Platform | 'all')}
          options={[{ value: 'all', label: 'wszystko' }, ...PLATFORMS.map((p) => ({ value: p, label: p }))]}
        />
        <Link
          href="/agents/social-publisher"
          className="ml-auto text-xs px-3 py-1.5 rounded border border-border hover:border-foreground/40 transition"
        >
          + Nowy pakiet (przez social-publishera)
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {packages.length === 0
            ? 'Brak pakietów. Wygeneruj pierwszy przez social-publishera.'
            : 'Żaden pakiet nie pasuje do filtrów.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p)}
              className="text-left rounded-lg border border-border bg-card p-4 hover:border-foreground/30 transition"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-medium text-sm leading-tight">{p.title}</div>
                <StatusPill status={p.status} />
              </div>
              <PlatformPills platforms={p.platforms} />
              <div className="text-xs text-muted-foreground mt-3 space-y-0.5">
                {p.scheduledFor ? (
                  <div>📅 {p.scheduledFor.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</div>
                ) : null}
                {p.cta ? <div className="line-clamp-1">CTA: {p.cta}</div> : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <PackageModal pkg={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2 py-1 rounded border transition ${
            value === o.value
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:border-foreground/40'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
