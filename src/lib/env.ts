import { z } from 'zod';

const emptyToUndef = (v: unknown) => (v === '' ? undefined : v);

const schema = z.object({
  DATABASE_URL: z.preprocess(emptyToUndef, z.string().min(1, 'DATABASE_URL is required')),
  BLOB_READ_WRITE_TOKEN: z.preprocess(emptyToUndef, z.string().optional()),
  SESSION_SECRET: z.preprocess(
    emptyToUndef,
    z.string().min(32, 'SESSION_SECRET must be at least 32 characters — generate with: openssl rand -base64 48'),
  ),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('[env] invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
