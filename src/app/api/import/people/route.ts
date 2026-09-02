/**
 * Wczytanie skoroszytu do importu osób (plan/04 sekcja 2, krok 1).
 * Granica zaufania (Z13): schemat Zod na tym, co przyszło z formularza, potem
 * limity `checkFile`, dopiero na końcu otwarcie pliku. Nic tu nie dotyka bazy,
 * plik nie ląduje na dysku, żyje wyłącznie w pamięci procesu (plan/04 sekcja 7).
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSessionEmail } from '@/lib/auth';
import { checkFile, parseWorkbook } from '@/lib/import/parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const uploadSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) return Response.json({ error: 'Brak sesji' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'Brak pliku w formularzu' }, { status: 400 });
  }

  const parsed = uploadSchema.safeParse({ name: file.name, size: file.size });
  if (!parsed.success) {
    return Response.json({ error: 'Plik nie ma nazwy albo jest pusty' }, { status: 400 });
  }

  const check = checkFile(parsed.data.name, parsed.data.size);
  if (!check.ok) return Response.json({ error: check.message }, { status: 400 });

  const result = await parseWorkbook(parsed.data.name, await file.arrayBuffer(), parsed.data.size);
  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });

  return Response.json({ sheets: result.sheets });
}
