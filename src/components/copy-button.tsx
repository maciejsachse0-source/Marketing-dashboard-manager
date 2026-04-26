'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyButton({ text, label = 'Skopiuj' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      {copied ? '✓ Skopiowano' : label}
    </Button>
  );
}
