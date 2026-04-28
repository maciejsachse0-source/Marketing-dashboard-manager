import { Camera, Mic } from 'lucide-react';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

const SIZE = {
  sm: { box: 'w-7 h-7', text: 'text-[10px]', badge: 'w-3 h-3', icon: 'w-2 h-2' },
  md: { box: 'w-10 h-10', text: 'text-xs', badge: 'w-4 h-4', icon: 'w-2.5 h-2.5' },
  lg: { box: 'w-12 h-12', text: 'text-sm', badge: 'w-4.5 h-4.5', icon: 'w-3 h-3' },
  xl: { box: 'w-20 h-20', text: 'text-xl', badge: 'w-5 h-5', icon: 'w-3 h-3' },
} as const;

export function PersonAvatar({
  name,
  seed,
  size = 'md',
  kind = 'artist',
  imageUrl,
  showBadge = true,
}: {
  name: string;
  seed?: string | null;
  size?: keyof typeof SIZE;
  kind?: 'artist' | 'videographer';
  imageUrl?: string | null;
  showBadge?: boolean;
}) {
  const baseSeed = seed ?? name;
  const hue = hashHue(baseSeed);
  const cls = SIZE[size];

  // Artists get a wider hue range (vivid palette across the spectrum).
  // Videographers stay in cool blues/teals so they read as "crew, not talent".
  const finalHue = kind === 'videographer' ? 180 + (hashHue(baseSeed) % 80) : hue;
  const bg = `linear-gradient(135deg, oklch(0.75 0.16 ${finalHue}) 0%, oklch(0.55 0.18 ${(finalHue + 30) % 360}) 100%)`;

  const Icon = kind === 'videographer' ? Camera : Mic;

  return (
    <div className="relative shrink-0">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className={`${cls.box} rounded-full object-cover shadow-sm ring-2 ring-background bg-muted`}
          loading="lazy"
        />
      ) : (
        <div
          aria-hidden
          className={`${cls.box} rounded-full grid place-items-center font-semibold text-white shadow-sm ring-2 ring-background`}
          style={{ background: bg }}
        >
          <span className={`${cls.text} tracking-tight`}>{initials(name)}</span>
        </div>
      )}
      {showBadge ? (
        <span
          aria-hidden
          className={`${cls.badge} absolute -bottom-0.5 -right-0.5 rounded-full grid place-items-center bg-foreground text-background ring-2 ring-background`}
        >
          <Icon className={cls.icon} strokeWidth={2.5} />
        </span>
      ) : null}
    </div>
  );
}

// Backwards-compatible alias (already imported elsewhere).
export const ArtistAvatar = PersonAvatar;

export function SoloAvatar({ size = 'md' }: { size?: keyof typeof SIZE }) {
  const cls = SIZE[size];
  return (
    <div
      aria-hidden
      className={`${cls.box} rounded-full grid place-items-center bg-foreground text-background shrink-0 shadow-sm ring-2 ring-background`}
    >
      <Camera
        className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'}
        strokeWidth={2.25}
      />
    </div>
  );
}
