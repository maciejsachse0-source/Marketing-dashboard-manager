'use server';

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { safeRevalidatePath as revalidatePath } from './revalidate';
import {
  agentDefSchema,
  AGENT_SIDE_PANELS,
  type AgentDef,
  type AgentSidePanel,
} from '@/lib/agents/types';
import { agentFilePath, getAgent, loadAgents } from '@/lib/agents';

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

function writeAgent(def: AgentDef) {
  const file = agentFilePath(def.slug);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(def, null, 2) + '\n', 'utf8');
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
  if (getAgent(slug)) throw new Error(`Agent o slugu "${slug}" już istnieje.`);
  const def = inputToDef(parsed, slug);
  writeAgent(def);
  bumpRevalidations(slug);
  return def;
}

export async function updateAgent(
  slug: string,
  rawInput: AgentFormInput,
): Promise<AgentDef> {
  const parsed = formSchema.parse(rawInput);
  if (!getAgent(slug)) throw new Error(`Agent "${slug}" nie istnieje.`);
  const def = inputToDef(parsed, slug);
  writeAgent(def);
  bumpRevalidations(slug);
  return def;
}

export async function deleteAgent(slug: string) {
  const file = agentFilePath(slug);
  if (!fs.existsSync(file)) throw new Error(`Agent "${slug}" nie istnieje.`);
  if (loadAgents().length <= 1) {
    throw new Error('Nie można usunąć ostatniego agenta.');
  }
  fs.unlinkSync(file);
  bumpRevalidations();
}

export async function cloneAgent(
  sourceSlug: string,
  newSlug: string,
  newName?: string,
): Promise<AgentDef> {
  const source = getAgent(sourceSlug);
  if (!source) throw new Error(`Agent źródłowy "${sourceSlug}" nie istnieje.`);
  if (getAgent(newSlug)) throw new Error(`Slug "${newSlug}" jest już zajęty.`);
  const def = agentDefSchema.parse({
    ...source,
    slug: newSlug,
    name: newName?.trim() || `${source.name} (kopia)`,
  });
  writeAgent(def);
  bumpRevalidations(newSlug);
  return def;
}
