import type { Platform } from '../../drizzle/schema';

const COLORS: Record<Platform, string> = {
  instagram: 'bg-pink-100 text-pink-800 border-pink-300',
  tiktok: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  youtube: 'bg-red-100 text-red-800 border-red-300',
  facebook: 'bg-blue-100 text-blue-800 border-blue-300',
  x: 'bg-zinc-100 text-zinc-800 border-zinc-300',
  linkedin: 'bg-sky-100 text-sky-800 border-sky-300',
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
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : status === 'ready'
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-zinc-100 text-zinc-700 border-zinc-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${color}`}>
      {status}
    </span>
  );
}
