import ExcelJS from 'exceljs';

export interface ParsedSheet {
  sheetName: string;
  data: unknown[][];
}

/**
 * Parses an Excel or CSV file buffer into raw data arrays.
 */
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        row.push(current);
        result.push(row);
        row = [];
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  if (current || row.length > 0) {
    row.push(current);
    result.push(row);
  }
  
  return result;
}

/**
 * Normalize Excel date serial numbers and JS Date objects to YYYY-MM-01 strings.
 * Excel stores dates as serial numbers (e.g. 45383 = April 1, 2024).
 * ExcelJS may return them as Date objects or raw numbers depending on cell format.
 */
function normalizeExcelDate(value: unknown): string | null {
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}-01`
  }
  if (typeof value === 'number' && value > 40000 && value < 60000) {
    // Excel serial: days since 1900-01-01 (with Lotus 1-2-3 leap year bug)
    const msPerDay = 86400000
    const excelEpoch = new Date(1899, 11, 30).getTime()
    const date = new Date(excelEpoch + value * msPerDay)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}-01`
  }
  return null
}

/**
 * Normalize a cell value — unwrap rich text, fix dates, return primitives.
 */
function normalizeCell(cell: unknown): unknown {
  if (cell === null || cell === undefined) return null
  // Unwrap rich text objects
  if (typeof cell === 'object' && 'richText' in (cell as object)) {
    return (cell as { richText: { text: string }[] }).richText.map((r) => r.text).join('')
  }
  // Normalize Excel date serials and JS Date objects
  const asDate = normalizeExcelDate(cell)
  if (asDate) return asDate
  return cell
}

export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<ParsedSheet[]> {
  // Reject files >10MB to prevent OOM in serverless environment
  const MAX_SIZE = 10 * 1024 * 1024
  if (buffer.byteLength > MAX_SIZE) {
    throw new Error(`File too large (${Math.round(buffer.byteLength / 1024 / 1024)}MB). Maximum size is 10MB.`)
  }

  const uint8 = new Uint8Array(buffer);
  const isZip = uint8.length >= 2 && uint8[0] === 0x50 && uint8[1] === 0x4B;

  if (!isZip) {
    const text = new TextDecoder().decode(buffer);
    const data = parseCSV(text);
    
    while (data.length > 0 && data[data.length - 1].every((c) => !c || String(c).trim() === '')) {
      data.pop();
    }
    
    if (data.length > 0) {
      return [{ sheetName: 'Import', data }];
    }
    return [];
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const result: ParsedSheet[] = [];

  workbook.eachSheet((worksheet) => {
    const data: unknown[][] = [];

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const rowValues = row.values as unknown[];
      // ExcelJS row.values is 1-indexed (index 0 is undefined), slice from 1
      const cells = rowValues.slice(1).map((cell) => normalizeCell(cell));
      data.push(cells);
    });

    // Trim empty rows from the end
    while (data.length > 0 && data[data.length - 1].every((c) => c == null || c === '')) {
      data.pop();
    }

    if (data.length > 0) {
      result.push({ sheetName: worksheet.name, data });
    }
  });

  return result;
}
