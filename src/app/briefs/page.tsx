import { PageShell } from '@/components/page-shell';
import { BriefsShell, type BriefRow } from '@/components/briefs/briefs-shell';
import { listBriefFiles, readBriefFile } from '@/lib/briefs-files';

export const dynamic = 'force-dynamic';

export default async function BriefsPage() {
  const files = listBriefFiles();
  const rows: BriefRow[] = files.map((f) => ({
    filename: f.filename,
    path: f.path,
    modifiedAt: f.modifiedAt.toISOString(),
    sizeBytes: f.sizeBytes,
    kind: f.kind,
  }));

  const contentByFilename: Record<string, string> = {};
  for (const f of files) {
    contentByFilename[f.filename] = readBriefFile(f.filename) ?? '';
  }

  return (
    <PageShell
      title="Briefy i wrapy"
      description="Pliki markdown zapisane przez content-brief i weekly-wrap."
    >
      <BriefsShell rows={rows} contentByFilename={contentByFilename} />
    </PageShell>
  );
}
