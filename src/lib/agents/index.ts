import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import {
  agentDefSchema,
  type AgentDef,
  type AgentMeta,
  type AgentSlug,
} from './types';

const AGENTS_DIR = path.join(process.cwd(), 'data', 'agents');

/**
 * Reads + validates every JSON in data/agents/ on each call. The directory
 * is small (≤ ~20 files) and reads are cached by the OS, so re-reading on
 * each request is fine and gives us hot-reload without any cache busting.
 */
export function loadAgents(): AgentDef[] {
  if (!fs.existsSync(AGENTS_DIR)) return [];
  const files = fs
    .readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const agents: AgentDef[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `Agent JSON ${file} jest niepoprawny: ${(e as Error).message}`,
      );
    }
    const result = agentDefSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Agent JSON ${file} nie przeszedł walidacji: ${result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    const expectedSlug = file.replace(/\.json$/, '');
    if (result.data.slug !== expectedSlug) {
      throw new Error(
        `Agent JSON ${file} ma slug "${result.data.slug}", oczekiwano "${expectedSlug}".`,
      );
    }
    agents.push(result.data);
  }
  return agents;
}

export function loadAgentMeta(): AgentMeta[] {
  return loadAgents().map(({ slug, name, description, sidePanel }) => ({
    slug,
    name,
    description,
    sidePanel,
  }));
}

export function getAgent(slug: string): AgentDef | undefined {
  return loadAgents().find((a) => a.slug === slug);
}

export function agentFilePath(slug: string): string {
  return path.join(AGENTS_DIR, `${slug}.json`);
}

export type { AgentDef, AgentMeta, AgentSlug } from './types';
