'use client';

import { useRef, useState, useTransition } from 'react';
import { Upload, FileText, Trash2 } from 'lucide-react';
import { uploadProductionAttachment } from '@/server/actions/production-attachments';
import type { Attachment } from '@/lib/production-files';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileZone({
  productionId,
  stage,
  attachments,
  hint,
}: {
  productionId: number;
  stage: string;
  attachments: Attachment[];
  hint?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    startTransition(async () => {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', f);
        const res = await uploadProductionAttachment(productionId, stage, fd);
        if (!res.ok) {
          setError(res.error);
          break;
        }
      }
    });
  };

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition ${
          dragOver
            ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-tint)]'
            : 'border-border hover:border-foreground/40 hover:bg-muted/30'
        } ${pending ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <Upload className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
        <span className="text-xs text-muted-foreground flex-1 min-w-0">
          {pending ? 'Wgrywam…' : (hint ?? 'Przeciągnij plik tu lub kliknij')}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => upload(e.target.files)}
        />
      </label>

      {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}

      {attachments.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {attachments.map((a) => (
            <li
              key={a.relativePath}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 text-xs hover:bg-muted/70 transition"
            >
              <FileText
                className="w-3.5 h-3.5 text-[var(--accent-blue)] shrink-0"
                strokeWidth={1.75}
              />
              <span className="flex-1 truncate font-medium">{a.filename}</span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {formatBytes(a.size)}
              </span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {a.uploadedAt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
