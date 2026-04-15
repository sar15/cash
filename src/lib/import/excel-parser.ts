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

export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<ParsedSheet[]> {
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
      const cells = rowValues.slice(1).map((cell) => {
        if (cell === null || cell === undefined) return null;
        // Unwrap rich text objects
        if (typeof cell === 'object' && 'richText' in (cell as object)) {
          return (cell as { richText: { text: string }[] }).richText
            .map((r) => r.text)
            .join('');
        }
        return cell;
      });
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
