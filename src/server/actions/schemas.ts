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

/**
 * Prymitywy powtarzające się w argumentach akcji serwerowych (zasada Z13).
 * Akcja serwerowa jest publicznym punktem wejścia — przeglądarka może wysłać
 * cokolwiek, więc argument prosty też przechodzi przez schemat.
 */
export const idSchema = z.number().int().positive();
/** Identyfikator kroku albo kamienia milowego w JSON-ie produkcji i kampanii. */
export const opaqueIdSchema = z.string().min(1).max(200);
/** Slug pliku definicji (agent, szablon): bez ukośnika i kropki, więc bez ucieczki z katalogu. */
export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug: małe litery, cyfry i myślniki');
export const labelSchema = z.string().min(1).max(200);
export const descriptionSchema = z.string().max(2000);
export const isoDateSchema = isoDate;
/** Metadane pliku z formularza. Nazwa i rozmiar to wejście od użytkownika (Z13). */
export const uploadedFileSchema = (maxBytes: number) =>
  z.object({
    name: z.string().min(1).max(255),
    size: z.number().int().positive().max(maxBytes),
  });
export const markModeSchema = z.enum(['mark', 'unmark']);
export const moveDirectionSchema = z.enum(['up', 'down']);

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

/** Metryki dosypywane do posta z importu CSV (granica zaufania Z13). */
export const postMetricsSchema = z
  .object({
    reach: z.number().int().min(0),
    impressions: z.number().int().min(0),
    engagementRate: z.number().min(0),
    completionRate: z.number().min(0),
    saves: z.number().int().min(0),
    shares: z.number().int().min(0),
    comments: z.number().int().min(0),
    followersGained: z.number().int(),
    rawCsvRowId: z.number().int().positive(),
  })
  .partial();

/** Filtr listy produkcji. */
export const productionFilterSchema = z
  .object({ type: productionTypeSchema.optional() })
  .optional();

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
  // F7-32: `contact` to pole ZASTANE — jedna linijka, w której siedział albo mail,
  // albo telefon, albo nick. Migracja 0003 dołożyła trzy własne kolumny; formularz
  // i karta pracują na nich, `contact` zostaje tylko dla wierszy, których
  // `scripts/split-videographer-contact.ts` nie umiał rozpoznać.
  contact: z.string().max(200).optional().nullable(),
  handle: z.string().max(120).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
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
