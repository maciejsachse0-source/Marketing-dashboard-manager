import { z } from 'zod';

const emptyToUndef = (v: unknown) => (v === '' ? undefined : v);

const schema = z.object({
  DATABASE_URL: z.preprocess(emptyToUndef, z.string().min(1, 'DATABASE_URL is required')),
  BLOB_READ_WRITE_TOKEN: z.preprocess(emptyToUndef, z.string().optional()),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('[env] invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
