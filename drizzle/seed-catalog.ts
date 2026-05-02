/**
 * One-shot backfill: read every JSON in `data/agents/`, `data/templates/`,
 * `data/campaign-templates/` and upsert into the new Postgres tables. Safe to
 * re-run — uses ON CONFLICT (slug) DO UPDATE.
 *
 * Run locally before the catalog tables are in active use:
 *   npm run db:seed:catalog
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[seed-catalog] DATABASE_URL not set');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  const root = process.cwd();

  // Agents
  const agentsDir = join(root, 'data', 'agents');
  const agentFiles = safeReaddir(agentsDir).filter((f) => f.endsWith('.json'));
  for (const f of agentFiles) {
    const raw = JSON.parse(readFileSync(join(agentsDir, f), 'utf8')) as {
      slug: string;
      name: string;
      description: string;
      systemPrompt: string;
      sidePanel: string;
      dashboardWidget?: { query: string; template: string } | null;
    };
    await db
      .insert(schema.agents)
      .values({
        slug: raw.slug,
        name: raw.name,
        description: raw.description,
        systemPrompt: raw.systemPrompt,
        sidePanel: raw.sidePanel,
        dashboardWidget: raw.dashboardWidget ?? null,
      })
      .onConflictDoUpdate({
        target: schema.agents.slug,
        set: {
          name: raw.name,
          description: raw.description,
          systemPrompt: raw.systemPrompt,
          sidePanel: raw.sidePanel,
          dashboardWidget: raw.dashboardWidget ?? null,
          updatedAt: new Date(),
        },
      });
    console.log(`[seed-catalog] agent ${raw.slug}`);
  }

  // Production templates
  const tplDir = join(root, 'data', 'templates');
  const tplFiles = safeReaddir(tplDir).filter((f) => f.endsWith('.json'));
  for (const f of tplFiles) {
    const raw = JSON.parse(readFileSync(join(tplDir, f), 'utf8')) as {
      slug: string;
      name: string;
      type: 'with-artist' | 'solo';
      summary: string;
      description: string;
      steps: unknown;
      periods?: unknown;
    };
    await db
      .insert(schema.productionTemplates)
      .values({
        slug: raw.slug,
        name: raw.name,
        type: raw.type,
        summary: raw.summary,
        description: raw.description,
        steps: raw.steps as never,
        periods: (raw.periods ?? null) as never,
      })
      .onConflictDoUpdate({
        target: schema.productionTemplates.slug,
        set: {
          name: raw.name,
          type: raw.type,
          summary: raw.summary,
          description: raw.description,
          steps: raw.steps as never,
          periods: (raw.periods ?? null) as never,
          updatedAt: new Date(),
        },
      });
    console.log(`[seed-catalog] production-template ${raw.slug}`);
  }

  // Marketing templates
  const mTplDir = join(root, 'data', 'campaign-templates');
  const mTplFiles = safeReaddir(mTplDir).filter((f) => f.endsWith('.json'));
  for (const f of mTplFiles) {
    const raw = JSON.parse(readFileSync(join(mTplDir, f), 'utf8')) as {
      slug: string;
      name: string;
      summary: string;
      description: string;
      periods?: unknown;
      milestones: unknown;
    };
    await db
      .insert(schema.marketingTemplates)
      .values({
        slug: raw.slug,
        name: raw.name,
        summary: raw.summary,
        description: raw.description,
        periods: (raw.periods ?? null) as never,
        milestones: raw.milestones as never,
      })
      .onConflictDoUpdate({
        target: schema.marketingTemplates.slug,
        set: {
          name: raw.name,
          summary: raw.summary,
          description: raw.description,
          periods: (raw.periods ?? null) as never,
          milestones: raw.milestones as never,
          updatedAt: new Date(),
        },
      });
    console.log(`[seed-catalog] marketing-template ${raw.slug}`);
  }

  console.log('[seed-catalog] done.');
  await sql.end();
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
