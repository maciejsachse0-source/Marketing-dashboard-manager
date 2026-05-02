import { NextRequest } from 'next/server';
import { deleteProduction } from '@/server/actions/productions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY debug endpoint — calls deleteProduction the same way the
 * UI server action does, but returns the full error stack as JSON so we
 * can see what crashes on Vercel. Remove once delete is fixed.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const idStr = url.searchParams.get('id');
  if (!idStr) return Response.json({ error: 'missing id' }, { status: 400 });
  const id = Number(idStr);
  if (!Number.isFinite(id)) return Response.json({ error: 'bad id' }, { status: 400 });

  try {
    await deleteProduction(id);
    return Response.json({ ok: true, id });
  } catch (err) {
    const e = err as Error;
    return Response.json(
      {
        ok: false,
        message: e.message,
        name: e.name,
        stack: e.stack,
        cause: e.cause ? String(e.cause) : undefined,
      },
      { status: 500 },
    );
  }
}
