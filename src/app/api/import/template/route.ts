import { NextResponse } from 'next/server'

import { buildImportTemplateCsv } from '@/lib/server/imports'

export async function GET() {
  const csv = buildImportTemplateCsv()

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="cashflowiq-import-template.csv"',
    },
  })
}
