'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { saveText } from '@/lib/files';
import { requireSession } from '@/lib/auth';
import { outreachInputSchema, type OutreachInput } from './schemas';
import { touchLastContact } from './artists';

export async function saveOutreach(input: OutreachInput) {
  await requireSession();
  const parsed = outreachInputSchema.parse(input);
  const md = `---
artistId: ${parsed.artistId}
type: ${parsed.type}
subject: ${JSON.stringify(parsed.subject)}
date: ${new Date().toISOString()}
---

# ${parsed.subject}

${parsed.body}
`;
  const path = await saveText('outreach', parsed.filename, md);
  await touchLastContact(parsed.artistId);
  revalidatePath('/artists');
  return { path };
}
