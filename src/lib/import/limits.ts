/**
 * Limity pliku importu i sprawdzenie samego pliku, bez otwierania go.
 * Osobny moduł, bo ten kod działa też w przeglądarce (natychmiastowa reakcja
 * strefy zrzutu), a `parse.ts` ciągnie za sobą `exceljs`, którego do bundla
 * strony wpuścić nie wolno.
 */
export const IMPORT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxRows: 5000,
  maxColumns: 60,
} as const;

export function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',');
}

export function checkFile(fileName: string, size: number): { ok: true } | { ok: false; message: string } {
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    return { ok: false, message: 'Ten format nie jest obsługiwany. Wgraj plik xlsx' };
  }
  if (size > IMPORT_LIMITS.maxBytes) {
    return {
      ok: false,
      message: `Plik ma ${megabytes(size)} MB, a limit to ${megabytes(IMPORT_LIMITS.maxBytes)} MB`,
    };
  }
  return { ok: true };
}
