import { PageShell } from '@/components/page-shell';
import { listOutputFolders, readPlatformCaption } from '@/lib/output-folder';
import { OutputGallery, type OutputItem } from '@/components/output/output-gallery';
import type { Platform } from '../../../drizzle/schema';

export const dynamic = 'force-dynamic';

export default async function OutputPage() {
  const folders = await listOutputFolders();

  const items: OutputItem[] = folders.map((f) => {
    const captions: Partial<Record<Platform, string>> = {};
    for (const platform of f.platforms) {
      const content = readPlatformCaption(f.folderPath, platform);
      if (content) captions[platform] = content;
    }
    return {
      productionId: f.productionId,
      title: f.title,
      status: f.status as OutputItem['status'],
      type: f.type,
      t0At: f.t0At,
      folderPath: f.folderPath,
      videoPath: f.videoPath,
      thumbnailPath: f.thumbnailPath,
      platforms: f.platforms,
      captions,
    };
  });

  return (
    <PageShell
      title="Folder publikacji"
      description="Produkcje zaakceptowane (status=approved) — gotowe do uploadu na sociale."
    >
      <OutputGallery items={items} />
    </PageShell>
  );
}
