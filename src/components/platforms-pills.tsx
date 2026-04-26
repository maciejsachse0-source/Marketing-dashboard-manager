import type { Platform } from '../../drizzle/schema';

const COLORS: Record<Platform, string> = {
  instagram: 'bg-pink-500/15 text-pink-300 border-pink-500/40',
  tiktok: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  youtube: 'bg-red-500/15 text-red-300 border-red-500/40',
  facebook: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  x: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
  linkedin: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
};

const LABELS: Record<Platform, string> = {
  instagram: 'IG',
  tiktok: 'TT',
  youtube: 'YT',
  facebook: 'FB',
  x: 'X',
  linkedin: 'LI',
};

export function PlatformPill({ platform, full = false }: { platform: Platform; full?: boolean }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${COLORS[platform]}`}
    >
      {full ? platform : LABELS[platform]}
    </span>
  );
}

export function PlatformPills({ platforms, full = false }: { platforms: Platform[]; full?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {platforms.map((p) => (
        <PlatformPill key={p} platform={p} full={full} />
      ))}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const color =
    status === 'published'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      : status === 'ready'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
        : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${color}`}>
      {status}
    </span>
  );
}
