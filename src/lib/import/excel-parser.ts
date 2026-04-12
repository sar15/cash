import * as xlsx from 'xlsx';

export interface ParsedSheet {
  sheetName: string;
  data: unknown[][];
}

/**
 * Parses an Excel or CSV file buffer into raw data arrays.
 */
export function parseExcelBuffer(buffer: ArrayBuffer): ParsedSheet[] {
  const workbook = xlsx.read(buffer, { type: 'array' });
  const result: ParsedSheet[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert to array of arrays
    const data = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: null });
    
    // Trim empty rows from the end to keep it clean
    while (data.length > 0 && data[data.length - 1].every(cell => cell == null || cell === '')) {
      data.pop();
    }
    
    if (data.length > 0) {
      result.push({ sheetName, data });
    }
  }
  
  return result;
}
