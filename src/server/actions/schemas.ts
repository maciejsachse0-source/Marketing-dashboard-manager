import { z } from 'zod';
import {
  PLATFORMS,
  CALENDAR_TYPES,
  CALENDAR_STATUSES,
  CAMPAIGN_PHASES,
  CSV_SOURCES,
  PRODUCTION_TYPES,
  PRODUCTION_STATUSES,
} from '../../../drizzle/schema';

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'Invalid ISO datetime',
});

export const platformSchema = z.enum(PLATFORMS);
export const calendarTypeSchema = z.enum(CALENDAR_TYPES);
export const calendarStatusSchema = z.enum(CALENDAR_STATUSES);
export const campaignPhaseSchema = z.enum(CAMPAIGN_PHASES);
export const csvSourceSchema = z.enum(CSV_SOURCES);
export const productionTypeSchema = z.enum(PRODUCTION_TYPES);
export const productionStatusSchema = z.enum(PRODUCTION_STATUSES);

export const calendarEntryInputSchema = z.object({
  type: calendarTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  startsAt: isoDate,
  endsAt: isoDate,
  platforms: z.array(platformSchema).optional().nullable(),
  artistId: z.number().int().positive().optional().nullable(),
  campaignId: z.number().int().positive().optional().nullable(),
  briefPath: z.string().max(500).optional().nullable(),
  status: calendarStatusSchema.optional(),
});
export type CalendarEntryInput = z.infer<typeof calendarEntryInputSchema>;

export const calendarEntryUpdateSchema = calendarEntryInputSchema.partial().extend({
  id: z.number().int().positive(),
});

export const artistInputSchema = z.object({
  name: z.string().min(1).max(120),
  handle: z.string().max(80).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type ArtistInput = z.infer<typeof artistInputSchema>;

export const campaignInputSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().min(1).max(500),
  releaseAt: isoDate,
  phase: campaignPhaseSchema.optional(),
  kpis: z.record(z.string(), z.union([z.string(), z.number()])).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CampaignInput = z.infer<typeof campaignInputSchema>;

export const postInputSchema = z.object({
  publishedAt: isoDate,
  platform: platformSchema,
  title: z.string().min(1).max(300),
  caption: z.string().max(5000).default(''),
  hashtags: z.array(z.string()).optional().nullable(),
  assetPath: z.string().max(500).optional().nullable(),
  campaignId: z.number().int().positive().optional().nullable(),
});
export type PostInput = z.infer<typeof postInputSchema>;

export const outreachInputSchema = z.object({
  artistId: z.number().int().positive(),
  type: z.string().min(1).max(60),
  // Reject newlines so the subject can be safely interpolated into the YAML
  // frontmatter via JSON.stringify without producing a multi-line YAML scalar
  // that consumers can't parse.
  subject: z.string().min(1).max(300).regex(/^[^\n\r]+$/, 'Temat nie może zawierać nowej linii'),
  body: z.string().min(1),
  filename: z.string().min(1).max(200),
});
export type OutreachInput = z.infer<typeof outreachInputSchema>;

export const videographerInputSchema = z.object({
  name: z.string().min(1).max(120),
  contact: z.string().max(200).optional().nullable(),
  hourlyRate: z.number().min(0).optional().nullable(),
  equipment: z.string().max(2000).optional().nullable(),
  availabilityNotes: z.string().max(1000).optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type VideographerInput = z.infer<typeof videographerInputSchema>;

export const productionInputSchema = z.object({
  type: productionTypeSchema,
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(120).optional(),
  t0At: isoDate,
  // Required: every production maps to an artist folder on disk
  // (`<ROOT>/<artist>/<production>/...`). `partial()` callers (e.g.
  // updateProduction) still get an optional field thanks to Zod's partial
  // semantics.
  artistId: z.number().int().positive(),
  videographerId: z.number().int().positive().optional().nullable(),
  platforms: z.array(platformSchema).optional().nullable(),
  campaignId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type ProductionInput = z.infer<typeof productionInputSchema>;
