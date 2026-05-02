'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, Save, Plus, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AGENT_SIDE_PANELS,
  type AgentDef,
  type AgentSidePanel,
} from '@/lib/agents/types';
import {
  createAgent,
  updateAgent,
  deleteAgent,
  cloneAgent,
} from '@/server/actions/agents';

const SIDE_PANEL_LABELS: Record<AgentSidePanel, string> = {
  'calendar-14': 'Kalendarz · 14 dni',
  'recent-posts': 'Ostatnie posty',
  'artists-list': 'Lista artystów',
  'active-campaigns': 'Aktywne kampanie',
  'trend-bookmarks': 'Bookmarki trendów',
};

type Mode = 'create' | 'edit';

type State = {
  slug: string;
  name: string;
  description: string;
  sidePanel: AgentSidePanel;
  systemPrompt: string;
  widgetQuery: string;
  widgetTemplate: string;
};

function fromAgent(agent: AgentDef | undefined, defaultSlug = ''): State {
  return {
    slug: agent?.slug ?? defaultSlug,
    name: agent?.name ?? '',
    description: agent?.description ?? '',
    sidePanel: agent?.sidePanel ?? 'calendar-14',
    systemPrompt: agent?.systemPrompt ?? '',
    widgetQuery: agent?.dashboardWidget?.query ?? '',
    widgetTemplate: agent?.dashboardWidget?.template ?? '',
  };
}

export function AgentForm({
  mode,
  agent,
  cloneFrom,
}: {
  mode: Mode;
  agent?: AgentDef;
  cloneFrom?: AgentDef;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<State>(() =>
    fromAgent(mode === 'edit' ? agent : cloneFrom, ''),
  );

  const set = <K extends keyof State>(k: K, v: State[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const submit = () => {
    setError(null);
    const payload = {
      slug: state.slug.trim(),
      name: state.name.trim(),
      description: state.description.trim(),
      sidePanel: state.sidePanel,
      systemPrompt: state.systemPrompt,
      dashboardWidgetQuery: state.widgetQuery.trim() || undefined,
      dashboardWidgetTemplate: state.widgetTemplate.trim() || undefined,
    };
    if (!payload.name) return setError('Nazwa wymagana.');
    if (!payload.description) return setError('Opis wymagany.');
    if (!payload.systemPrompt.trim()) return setError('System prompt wymagany.');
    if (mode === 'create' && !payload.slug) return setError('Slug wymagany.');
    if (
      (payload.dashboardWidgetQuery && !payload.dashboardWidgetTemplate) ||
      (!payload.dashboardWidgetQuery && payload.dashboardWidgetTemplate)
    ) {
      return setError('Widget wymaga zarówno query jak i template (albo zostaw oba puste).');
    }
    startTransition(async () => {
      try {
        if (mode === 'create') {
          const created = await createAgent(payload);
          toast.success(`Utworzono agenta: ${created.name}`);
          router.push(`/agents/${created.slug}`);
        } else if (agent) {
          await updateAgent(agent.slug, payload);
          toast.success('Zapisano zmiany');
          router.push(`/agents/${agent.slug}`);
          router.refresh();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error('Błąd zapisu', { description: msg });
      }
    });
  };

  const remove = () => {
    if (!agent) return;
    if (!confirm(`Usunąć agenta "${agent.name}"? Tej operacji nie można cofnąć.`)) return;
    startTransition(async () => {
      try {
        await deleteAgent(agent.slug);
        toast.success(`Usunięto: ${agent.name}`);
        router.push('/agents');
      } catch (e) {
        toast.error('Błąd', { description: e instanceof Error ? e.message : String(e) });
      }
    });
  };

  const clone = () => {
    if (!agent) return;
    const newSlug = window.prompt(
      'Podaj slug dla kopii (małe litery, cyfry, myślniki):',
      `${agent.slug}-copy`,
    );
    if (!newSlug) return;
    startTransition(async () => {
      try {
        const created = await cloneAgent(agent.slug, newSlug.trim());
        toast.success(`Sklonowano: ${created.name}`);
        router.push(`/agents/${created.slug}/edit`);
      } catch (e) {
        toast.error('Błąd klonowania', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="slug">
            Slug {mode === 'create' ? '*' : <span className="text-muted-foreground">(stały)</span>}
          </Label>
          <Input
            id="slug"
            value={state.slug}
            onChange={(e) => set('slug', e.target.value.toLowerCase())}
            placeholder="np. brand-voice-coach"
            disabled={mode === 'edit'}
            className="font-mono text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Plik: <code>data/agents/{state.slug || '<slug>'}.json</code> · wywołanie:{' '}
            <code>@agents/{state.slug || '<slug>'}.md</code>
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="name">Nazwa *</Label>
          <Input
            id="name"
            value={state.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Brand Voice Coach"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="description">Opis (1 linia, do 280 znaków) *</Label>
        <Input
          id="description"
          value={state.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Co ten agent robi i kiedy go uruchomić."
          maxLength={280}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sidePanel">Panel kontekstu (po prawej stronie)</Label>
        <Select
          value={state.sidePanel}
          onValueChange={(v) => set('sidePanel', v as AgentSidePanel)}
        >
          <SelectTrigger id="sidePanel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_SIDE_PANELS.map((p) => (
              <SelectItem key={p} value={p}>
                {SIDE_PANEL_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Określa jakie dane z bazy widać podczas pracy agenta.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="systemPrompt">System prompt *</Label>
        <Textarea
          id="systemPrompt"
          value={state.systemPrompt}
          onChange={(e) => set('systemPrompt', e.target.value)}
          rows={18}
          className="font-mono text-xs leading-relaxed"
          placeholder="Jesteś agentem od..."
        />
        <p className="text-[11px] text-muted-foreground">
          Persona dla Claude Code. Może zawierać instrukcje, formaty outputu, reguły, przykłady.
        </p>
      </div>

      <details className="rounded-md border border-border bg-muted/20 px-4 py-3">
        <summary className="text-sm font-medium cursor-pointer select-none">
          Widget na pulpicie (opcjonalny)
        </summary>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="widgetQuery">SQL query (read-only SELECT)</Label>
            <Textarea
              id="widgetQuery"
              value={state.widgetQuery}
              onChange={(e) => set('widgetQuery', e.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder="SELECT count(*) AS count FROM artists WHERE last_contact_at < unixepoch() * 1000 - 14*86400000"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="widgetTemplate">Template (mustache: {'{{column}}'})</Label>
            <Input
              id="widgetTemplate"
              value={state.widgetTemplate}
              onChange={(e) => set('widgetTemplate', e.target.value)}
              placeholder="{{count}} artystów bez kontaktu >14d"
              className="font-mono text-xs"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Hint pod nazwą agenta na pulpicie. Tylko SELECT — INSERT/UPDATE są blokowane.
          </p>
        </div>
      </details>

      {error ? (
        <p className="text-sm text-rose-600 px-3 py-2 rounded border border-rose-200 bg-rose-50">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <div className="flex gap-2">
          {mode === 'edit' && agent ? (
            <>
              <Button
                variant="ghost"
                onClick={remove}
                disabled={pending}
                className="text-rose-600 hover:text-rose-700"
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Usuń
              </Button>
              <Button variant="ghost" onClick={clone} disabled={pending}>
                <Copy className="w-4 h-4 mr-1.5" /> Klonuj
              </Button>
            </>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={pending}
          >
            Anuluj
          </Button>
          <Button onClick={submit} disabled={pending}>
            {mode === 'create' ? (
              <>
                <Plus className="w-4 h-4 mr-1.5" />
                {pending ? 'Tworzę…' : 'Utwórz agenta'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" />
                {pending ? 'Zapisuję…' : 'Zapisz'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
