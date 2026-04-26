import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { AGENT_LIST } from '@/lib/agents';

export default function AgentsListPage() {
  return (
    <PageShell title="Agenci" description="8 wirtualnych specjalistów do dyspozycji.">
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {AGENT_LIST.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/agents/${a.slug}`}
              className="block rounded-lg border border-border bg-card p-4 hover:border-foreground/30 transition"
            >
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
