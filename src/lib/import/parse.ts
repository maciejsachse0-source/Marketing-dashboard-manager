/**
 * Czytanie skoroszytu .xlsx (plan/04 sekcje 1 i 2). Wejście jest granicą zaufania:
 * najpierw limity, dopiero potem parsowanie. Plik odrzucony nigdy nie jest czytany.
 */
import ExcelJS from 'exceljs';

export const IMPORT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxRows: 5000,
  maxColumns: 60,
} as const;

export type ParsedSheet = {
  name: string;
  headers: string[];
  /** Wiersze danych, bez nagłówka. Komórka pusta to `null`. */
  rows: (string | number | boolean | Date | null)[][];
};

export type ParseResult =
  | { ok: true; sheets: ParsedSheet[] }
  | { ok: false; message: string };

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',');
}

/** Sprawdzenie samego pliku, bez otwierania go. */
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

/** Komórka złożona: hiperlink, formuła, tekst z formatowaniem. */
function objectCellValue(value: object): string | number | boolean | Date | null {
  if ('text' in value && typeof value.text === 'string') return value.text;
  if ('richText' in value) return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join('');
  if ('result' in value) return cellValue((value as ExcelJS.CellFormulaValue).result ?? null);
  return null;
}

function cellValue(value: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') return objectCellValue(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return null;
}

export async function parseWorkbook(
  fileName: string,
  data: ArrayBuffer | Buffer,
  size = data.byteLength,
): Promise<ParseResult> {
  const check = checkFile(fileName, size);
  if (!check.ok) return check;

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data as ArrayBuffer);
  } catch {
    return { ok: false, message: 'Nie udało się odczytać pliku. Sprawdź, czy to poprawny skoroszyt xlsx' };
  }

  const sheets: ParsedSheet[] = [];
  for (const worksheet of workbook.worksheets) {
    const dataRows = worksheet.rowCount - 1;
    if (dataRows > IMPORT_LIMITS.maxRows) {
      return {
        ok: false,
        message: `Arkusz "${worksheet.name}" ma ${dataRows} wierszy, a limit to ${IMPORT_LIMITS.maxRows}`,
      };
    }
    if (worksheet.columnCount > IMPORT_LIMITS.maxColumns) {
      return {
        ok: false,
        message: `Arkusz "${worksheet.name}" ma ${worksheet.columnCount} kolumn, a limit to ${IMPORT_LIMITS.maxColumns}`,
      };
    }

    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      headers.push(String(cellValue(headerRow.getCell(column).value) ?? '').trim());
    }

    const rows: ParsedSheet['rows'] = [];
    worksheet.eachRow((row, index) => {
      if (index === 1) return;
      const cells: ParsedSheet['rows'][number] = [];
      for (let column = 1; column <= headers.length; column += 1) {
        cells.push(cellValue(row.getCell(column).value));
      }
      rows.push(cells);
    });

    sheets.push({ name: worksheet.name, headers, rows });
  }

  return { ok: true, sheets };
}
