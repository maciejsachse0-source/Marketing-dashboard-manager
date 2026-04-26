'use client';

import { useEffect, useState } from 'react';
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
  Film,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AGENT_META } from '@/lib/agents/meta';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Pulpit', icon: LayoutDashboard },
  { href: '/calendar', label: 'Kalendarz', icon: CalendarDays },
  { href: '/productions', label: 'Produkcje', icon: Film },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-12 bg-background/80 backdrop-blur border-b border-border flex items-center px-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded hover:bg-muted transition"
          aria-label="Otwórz menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/" className="ml-2 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-chart-2 grid place-items-center">
            <Sparkles className="w-3 h-3 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight">Marketing Crew</span>
        </Link>
      </header>

      {/* Mobile backdrop */}
      {mobileOpen ? (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 bottom-0 lg:h-screen z-50 w-60 shrink-0 border-r border-sidebar-border bg-sidebar/95 backdrop-blur flex flex-col transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
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
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-muted transition"
            aria-label="Zamknij menu"
          >
            <X className="w-4 h-4" />
          </button>
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

        <div className="px-3 py-2 mt-auto overflow-y-auto">
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
            <span>Pomoc</span>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/30">
              ?
            </kbd>
          </div>
        </div>
      </aside>
    </>
  );
}
