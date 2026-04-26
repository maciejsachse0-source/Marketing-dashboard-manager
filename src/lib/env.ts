import { z } from 'zod';

const emptyToUndef = (v: unknown) => (v === '' ? undefined : v);

const schema = z.object({
  DATABASE_PATH: z.preprocess(
    emptyToUndef,
    z.string().optional().default('./data/marketing-crew.db'),
  ),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('[env] invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
