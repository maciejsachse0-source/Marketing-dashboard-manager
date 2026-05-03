'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { safeRevalidatePath as revalidatePath } from './revalidate';
import {
  agentDefSchema,
  AGENT_SIDE_PANELS,
  type AgentDef,
  type AgentSidePanel,
} from '@/lib/agents/types';
import { getAgent, loadAgents } from '@/lib/agents';
import { db, schema } from '@/lib/db';

export type AgentFormInput = {
  slug?: string;
  name: string;
  description: string;
  sidePanel: AgentSidePanel;
  systemPrompt: string;
  dashboardWidgetQuery?: string;
  dashboardWidgetTemplate?: string;
};

const formSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(280),
  sidePanel: z.enum(AGENT_SIDE_PANELS),
  systemPrompt: z.string().min(1),
  dashboardWidgetQuery: z.string().optional(),
  dashboardWidgetTemplate: z.string().optional(),
});

function inputToDef(input: AgentFormInput, slug: string): AgentDef {
  const widgetQuery = input.dashboardWidgetQuery?.trim();
  const widgetTemplate = input.dashboardWidgetTemplate?.trim();
  const dashboardWidget =
    widgetQuery && widgetTemplate ? { query: widgetQuery, template: widgetTemplate } : null;
  return agentDefSchema.parse({
    slug,
    name: input.name.trim(),
    description: input.description.trim(),
    sidePanel: input.sidePanel,
    systemPrompt: input.systemPrompt.trimEnd(),
    dashboardWidget,
  });
}

async function upsertAgent(def: AgentDef) {
  await db
    .insert(schema.agents)
    .values({
      slug: def.slug,
      name: def.name,
      description: def.description,
      systemPrompt: def.systemPrompt,
      sidePanel: def.sidePanel,
      dashboardWidget: def.dashboardWidget ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.agents.slug,
      set: {
        name: def.name,
        description: def.description,
        systemPrompt: def.systemPrompt,
        sidePanel: def.sidePanel,
        dashboardWidget: def.dashboardWidget ?? null,
        updatedAt: new Date(),
      },
    });
}

function bumpRevalidations(slug?: string) {
  revalidatePath('/');
  revalidatePath('/agents');
  if (slug) revalidatePath(`/agents/${slug}`);
}

export async function createAgent(rawInput: AgentFormInput): Promise<AgentDef> {
  const parsed = formSchema.parse(rawInput);
  const slug = parsed.slug?.trim();
  if (!slug) throw new Error('Slug jest wymagany.');
  if (await getAgent(slug)) throw new Error(`Agent o slugu "${slug}" już istnieje.`);
  const def = inputToDef(parsed, slug);
  await upsertAgent(def);
  bumpRevalidations(slug);
  return def;
}

export async function updateAgent(
  slug: string,
  rawInput: AgentFormInput,
): Promise<AgentDef> {
  const parsed = formSchema.parse(rawInput);
  if (!(await getAgent(slug))) throw new Error(`Agent "${slug}" nie istnieje.`);
  const def = inputToDef(parsed, slug);
  await upsertAgent(def);
  bumpRevalidations(slug);
  return def;
}

export async function deleteAgent(slug: string) {
  if (!(await getAgent(slug))) throw new Error(`Agent "${slug}" nie istnieje.`);
  if ((await loadAgents()).length <= 1) {
    throw new Error('Nie można usunąć ostatniego agenta.');
  }
  await db.delete(schema.agents).where(eq(schema.agents.slug, slug));
  bumpRevalidations();
}

export async function cloneAgent(
  sourceSlug: string,
  newSlug: string,
  newName?: string,
): Promise<AgentDef> {
  const source = await getAgent(sourceSlug);
  if (!source) throw new Error(`Agent źródłowy "${sourceSlug}" nie istnieje.`);
  if (await getAgent(newSlug)) throw new Error(`Slug "${newSlug}" jest już zajęty.`);
  const def = agentDefSchema.parse({
    ...source,
    slug: newSlug,
    name: newName?.trim() || `${source.name} (kopia)`,
  });
  await upsertAgent(def);
  bumpRevalidations(newSlug);
  return def;
}
