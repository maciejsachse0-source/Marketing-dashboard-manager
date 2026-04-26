'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Bot,
  PackageOpen,
  BarChart3,
  Megaphone,
  Users,
  FileText,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { AGENT_META } from '@/lib/agents/meta';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Pulpit', icon: LayoutDashboard },
  { href: '/calendar', label: 'Kalendarz', icon: CalendarDays },
  { href: '/agents', label: 'Agenci', icon: Bot },
  { href: '/packages', label: 'Pakiety', icon: PackageOpen },
  { href: '/analytics', label: 'Analityka', icon: BarChart3 },
  { href: '/campaigns', label: 'Kampanie', icon: Megaphone },
  { href: '/artists', label: 'Artyści', icon: Users },
  { href: '/briefs', label: 'Briefy & wrapy', icon: FileText },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar/80 backdrop-blur flex flex-col">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-chart-2 grid place-items-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition">
            <Sparkles className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Marketing Crew</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              dyspozytornia
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 mb-1">
          Główne
        </div>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition ${
                active
                  ? 'bg-sidebar-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              {active ? (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
              ) : null}
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : ''}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-2 mt-auto">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 mb-1">
          Agenci · Claude Code
        </div>
        <ul className="flex flex-col gap-0.5 mb-2">
          {AGENT_META.map((a) => {
            const active = pathname === `/agents/${a.slug}`;
            return (
              <li key={a.slug}>
                <Link
                  href={`/agents/${a.slug}`}
                  className={`block px-2.5 py-1 text-xs rounded transition ${
                    active
                      ? 'text-foreground bg-sidebar-accent/70'
                      : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40'
                  }`}
                >
                  {a.name}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="px-2 py-2 mt-2 text-[10px] text-muted-foreground/70 border-t border-sidebar-border/50 flex items-center justify-between">
          <span>Cmd+K</span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/30">
            ⌘ K
          </kbd>
        </div>
      </div>
    </aside>
  );
}
