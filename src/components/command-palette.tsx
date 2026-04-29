'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ChartGantt,
  Bot,
  PackageOpen,
  BarChart3,
  Megaphone,
  Users,
  FileText,
  Sparkles,
  Film,
  FolderOpen,
  Camera,
  Plus,
  Upload,
  Search,
  type LucideIcon,
} from 'lucide-react';
import type { AgentMeta } from '@/lib/agents/types';

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: LucideIcon;
  action: () => void;
};

export function CommandPalette({ agents }: { agents: AgentMeta[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      // small delay so the dialog mounts before focus
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const allItems: CommandItem[] = useMemo(() => {
    const go = (path: string) => () => {
      router.push(path);
      setOpen(false);
    };
    const pages: CommandItem[] = [
      { id: 'p:dashboard', label: 'Pulpit', hint: '/', group: 'Strony', icon: LayoutDashboard, action: go('/') },
      { id: 'p:calendar', label: 'Pipeline (Gantt)', hint: '/calendar', group: 'Strony', icon: ChartGantt, action: go('/calendar') },
      { id: 'p:productions', label: 'Produkcje', hint: '/productions', group: 'Strony', icon: Film, action: go('/productions') },
      { id: 'p:agents', label: 'Agenci', hint: '/agents', group: 'Strony', icon: Bot, action: go('/agents') },
      { id: 'p:packages', label: 'Pakiety', hint: '/packages', group: 'Strony', icon: PackageOpen, action: go('/packages') },
      { id: 'p:output', label: 'Folder publikacji', hint: '/output', group: 'Strony', icon: FolderOpen, action: go('/output') },
      { id: 'p:analytics', label: 'Analityka', hint: '/analytics', group: 'Strony', icon: BarChart3, action: go('/analytics') },
      { id: 'p:campaigns', label: 'Kampanie', hint: '/campaigns', group: 'Strony', icon: Megaphone, action: go('/campaigns') },
      { id: 'p:artists', label: 'Artyści', hint: '/artists', group: 'Strony', icon: Users, action: go('/artists') },
      { id: 'p:videographers', label: 'Kamerzyści', hint: '/videographers', group: 'Strony', icon: Camera, action: go('/videographers') },
      { id: 'p:briefs', label: 'Briefy & wrapy', hint: '/briefs', group: 'Strony', icon: FileText, action: go('/briefs') },
    ];

    const agentItems: CommandItem[] = agents.map((a) => ({
      id: `a:${a.slug}`,
      label: a.name,
      hint: a.description,
      group: 'Agenci',
      icon: Sparkles,
      action: go(`/agents/${a.slug}`),
    }));

    const actions: CommandItem[] = [
      {
        id: 'act:new-production',
        label: 'Nowa produkcja',
        hint: 'wizard',
        group: 'Akcje',
        icon: Film,
        action: go('/productions'),
      },
      {
        id: 'act:csv',
        label: 'Wgraj CSV z metrykami',
        hint: 'analityka / dropzone',
        group: 'Akcje',
        icon: Upload,
        action: go('/analytics'),
      },
      {
        id: 'act:add-entry',
        label: 'Dodaj wpis kalendarza',
        hint: 'kalendarz · nowy wpis',
        group: 'Akcje',
        icon: Plus,
        action: go('/calendar'),
      },
      {
        id: 'act:add-artist',
        label: 'Dodaj artystę',
        hint: 'baza artystów',
        group: 'Akcje',
        icon: Plus,
        action: go('/artists'),
      },
    ];

    return [...pages, ...agentItems, ...actions];
  }, [router, agents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => {
      const hay = (item.label + ' ' + (item.hint ?? '')).toLowerCase();
      return q.split(/\s+/).every((tok) => hay.includes(tok));
    });
  }, [allItems, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Group items
  const grouped = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const arr = groups.get(item.group) ?? [];
      arr.push(item);
      groups.set(item.group, arr);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const flatList = filtered;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flatList.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flatList[activeIdx]?.action();
    }
  };

  if (!open) return null;

  let runningIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-auto rounded-xl border border-border bg-popover shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Szukaj stron, agentów, akcji..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/30 text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {flatList.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Brak wyników dla „{query}"
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-2">
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                  {group}
                </div>
                {items.map((item) => {
                  const idx = runningIdx++;
                  const isActive = idx === activeIdx;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => item.action()}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition ${
                        isActive ? 'bg-primary/15 text-foreground' : 'text-foreground/85 hover:bg-muted/40'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                        strokeWidth={1.75}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint ? (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[40%]">
                          {item.hint}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
          <span>↑↓ nawigacja · ↵ wybór</span>
          <span>{flatList.length} {flatList.length === 1 ? 'wynik' : flatList.length < 5 ? 'wyniki' : 'wyników'}</span>
        </div>
      </div>
    </div>
  );
}
