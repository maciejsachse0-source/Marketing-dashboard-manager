import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, Copy } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { getAgent } from '@/lib/agents';
import { runAgentWidget } from '@/lib/agents/widget';
import { AgentContextPanel } from '@/components/agent-context-panel';
import { CopyButton } from '@/components/copy-button';

export const dynamic = 'force-dynamic';

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  const promptFile = `agents/${agent.slug}.md`;
  const invocation = `@${promptFile} ${agent.name} — działaj zgodnie z promptem.`;
  const widgetHint = agent.dashboardWidget ? await runAgentWidget(agent.dashboardWidget) : null;

  return (
    <PageShell
      title={agent.name}
      description={agent.description}
      actions={
        <div className="flex items-center gap-2">
          <Link
            href={`/agents/new?clone=${agent.slug}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted/40 transition"
          >
            <Copy className="w-4 h-4" /> Klonuj
          </Link>
          <Link
            href={`/agents/${agent.slug}/edit`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
          >
            <Pencil className="w-4 h-4" /> Edytuj
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Jak uruchomić
            </h2>
            <ol className="text-sm space-y-2 text-foreground/90 list-decimal list-inside">
              <li>
                Otwórz Claude Code w roocie projektu (
                <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  marketing-crew/
                </code>
                )
              </li>
              <li>
                Wskaż agenta:{' '}
                <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  @{promptFile}
                </code>{' '}
                + opisz czego potrzebujesz
              </li>
              <li>
                Agent ma dostęp do bazy SQLite (
                <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  data/marketing-crew.db
                </code>
                ) i plików projektu
              </li>
            </ol>
            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-muted px-2.5 py-2 rounded truncate">
                {invocation}
              </code>
              <CopyButton text={invocation} label="Skopiuj wywołanie" />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                System prompt
              </h2>
              <CopyButton text={agent.systemPrompt} label="Skopiuj prompt" />
            </div>
            <pre className="p-5 text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground/85 max-h-[60vh] overflow-y-auto">
              {agent.systemPrompt}
            </pre>
          </section>
        </div>

        <div className="space-y-4">
          <AgentContextPanel kind={agent.sidePanel} />
          {widgetHint ? (
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Widget pulpitu
              </div>
              <div className="text-sm font-medium text-primary">{widgetHint}</div>
            </div>
          ) : null}
          <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Workflow w Claude Code</div>
            Agent czyta kontekst (kalendarz/posty/artyści) bezpośrednio z SQLite. Po zmianach
            odśwież stronę — dane są live z bazy.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
