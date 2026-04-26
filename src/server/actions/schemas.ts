import { z } from 'zod';
import {
  PLATFORMS,
  CALENDAR_TYPES,
  CALENDAR_STATUSES,
  CAMPAIGN_PHASES,
  PACKAGE_STATUSES,
  CSV_SOURCES,
} from '../../../drizzle/schema';

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'Invalid ISO datetime',
});

export const platformSchema = z.enum(PLATFORMS);
export const calendarTypeSchema = z.enum(CALENDAR_TYPES);
export const calendarStatusSchema = z.enum(CALENDAR_STATUSES);
export const campaignPhaseSchema = z.enum(CAMPAIGN_PHASES);
export const packageStatusSchema = z.enum(PACKAGE_STATUSES);
export const csvSourceSchema = z.enum(CSV_SOURCES);

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

const partialPlatformMap = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    instagram: value.optional(),
    tiktok: value.optional(),
    youtube: value.optional(),
    facebook: value.optional(),
    x: value.optional(),
    linkedin: value.optional(),
  });

export const packageInputSchema = z.object({
  title: z.string().min(1).max(200),
  assetPath: z.string().max(500).optional().nullable(),
  platforms: z.array(platformSchema).min(1),
  captions: partialPlatformMap(z.string()),
  hashtags: partialPlatformMap(z.array(z.string())),
  cta: z.string().max(500).optional().nullable(),
  status: packageStatusSchema.optional(),
  campaignId: z.number().int().positive().optional().nullable(),
  scheduledFor: isoDate.optional().nullable(),
});
export type PackageInput = z.infer<typeof packageInputSchema>;

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

export const briefInputSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(120),
  markdown: z.string().min(1),
  filename: z.string().min(1).max(200),
  calendarEntryId: z.number().int().positive().nullable().optional(),
});
export type BriefInput = z.infer<typeof briefInputSchema>;

export const outreachInputSchema = z.object({
  artistId: z.number().int().positive(),
  type: z.string().min(1).max(60),
  subject: z.string().min(1).max(300),
  body: z.string().min(1),
  filename: z.string().min(1).max(200),
});
export type OutreachInput = z.infer<typeof outreachInputSchema>;
