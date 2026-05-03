import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { loadAgents } from '@/lib/agents';

export const dynamic = 'force-dynamic';

export default async function AgentsListPage() {
  const agents = await loadAgents();
  return (
    <PageShell
      title="Agenci"
      description={`${agents.length} wirtualnych specjalistów (Claude Code persony). Możesz edytować, klonować i dodawać własnych.`}
      actions={
        <Link
          href="/agents/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" /> Nowy agent
        </Link>
      }
    >
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {agents.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/agents/${a.slug}`}
              className="block rounded-lg border border-border bg-card p-4 hover:border-foreground/30 transition"
            >
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
              <div className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
                @agents/{a.slug}.md
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
