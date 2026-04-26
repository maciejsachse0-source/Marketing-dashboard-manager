import Link from 'next/link';
import { AGENT_LIST } from '@/lib/agents';

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Pulpit' },
  { href: '/calendar', label: 'Kalendarz' },
  { href: '/agents', label: 'Agenci' },
  { href: '/packages', label: 'Pakiety' },
  { href: '/analytics', label: 'Analityka' },
  { href: '/campaigns', label: 'Kampanie' },
  { href: '/artists', label: 'Artyści' },
  { href: '/briefs', label: 'Briefy & wrapy' },
];

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-muted/30 px-4 py-6 flex flex-col gap-6">
      <div className="px-2">
        <div className="text-sm uppercase tracking-wider text-muted-foreground">
          Marketing Crew
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-md text-sm hover:bg-muted transition"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-2 mt-auto">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Agenci
        </div>
        <ul className="flex flex-col gap-0.5">
          {AGENT_LIST.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/agents/${a.slug}`}
                className="block px-3 py-1.5 text-xs rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                {a.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
