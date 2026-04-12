'use client';
/* eslint-disable @next/next/no-img-element */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useMemo, useRef, useState } from 'react';
import { Download, FileText, LoaderCircle } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentForecast } from '@/hooks/use-current-forecast';
import { buildManagementReportData, type ManagementReportData } from '@/lib/reports/management-report';
import { formatLakhs } from '@/lib/utils/indian-format';
import { useWorkspaceStore } from '@/stores/workspace-store';

const REPORT_BORDER_STRONG = 'rgba(15, 23, 42, 0.10)';
const REPORT_BORDER_SOFT = 'rgba(15, 23, 42, 0.05)';
const REPORT_SURFACE = '#f8fafc';
const REPORT_SURFACE_STRONG = '#f1f5f9';
const REPORT_MUTED = '#64748b';
const REPORT_MUTED_STRONG = '#475569';

function sanitizeHtml2CanvasClone(clonedDocument: Document) {
  clonedDocument.documentElement.style.color = '#000000';
  clonedDocument.documentElement.style.backgroundColor = '#ffffff';
  clonedDocument.body.style.color = '#000000';
  clonedDocument.body.style.backgroundColor = '#ffffff';

  for (const element of Array.from(clonedDocument.querySelectorAll<HTMLElement>('*'))) {
    const style = clonedDocument.defaultView?.getComputedStyle(element);
    if (!style) {
      continue;
    }

    if (style.color.includes('oklch(')) {
      element.style.color = '#000000';
    }

    if (style.backgroundColor.includes('oklch(')) {
      element.style.backgroundColor = 'transparent';
    }

    const borderColors = [
      style.borderTopColor,
      style.borderRightColor,
      style.borderBottomColor,
      style.borderLeftColor,
    ];

    if (borderColors.some((color) => color.includes('oklch('))) {
      element.style.borderColor = REPORT_BORDER_STRONG;
    }

    if (style.outlineColor.includes('oklch(')) {
      element.style.outlineColor = 'transparent';
    }

    if (style.textDecorationColor.includes('oklch(')) {
      element.style.textDecorationColor = element.style.color || '#000000';
    }

    if (style.boxShadow.includes('oklch(')) {
      element.style.boxShadow = 'none';
    }
  }
}

function ReportTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<{
    label: string;
    values: number[];
    total: number;
    emphasize?: boolean;
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: REPORT_BORDER_STRONG }}>
      <table className="w-full border-collapse text-[10px]">
        <thead style={{ backgroundColor: REPORT_SURFACE_STRONG }}>
          <tr>
            <th className="border-b px-3 py-2 text-left font-semibold" style={{ borderColor: REPORT_BORDER_STRONG }}>
              Account Name
            </th>
            {headers.map((header) => (
              <th
                key={header}
                className="border-b px-2 py-2 text-right font-semibold"
                style={{ borderColor: REPORT_BORDER_STRONG }}
              >
                {header}
              </th>
            ))}
            <th className="border-b px-2 py-2 text-right font-semibold" style={{ borderColor: REPORT_BORDER_STRONG }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={row.emphasize ? 'font-semibold' : ''}
              style={row.emphasize ? { backgroundColor: REPORT_SURFACE } : undefined}
            >
              <td className="border-b px-3 py-2" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {row.label}
              </td>
              {row.values.map((value, index) => (
                <td
                  key={`${row.label}-${index}`}
                  className="border-b px-2 py-2 text-right"
                  style={{ borderColor: REPORT_BORDER_SOFT }}
                >
                  {formatLakhs(value, 1)}
                </td>
              ))}
              <td className="border-b px-2 py-2 text-right" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {formatLakhs(row.total, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComplianceTable({ report }: { report: ManagementReportData }) {
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: REPORT_BORDER_STRONG }}>
      <table className="w-full border-collapse text-[10px]">
        <thead style={{ backgroundColor: REPORT_SURFACE_STRONG }}>
          <tr>
            {['Month', 'GST', 'TDS', 'PF', 'ESI', 'Advance Tax', 'Total'].map((header) => (
              <th
                key={header}
                className="border-b px-3 py-2 text-right font-semibold first:text-left"
                style={{ borderColor: REPORT_BORDER_STRONG }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.complianceRows.map((row) => (
            <tr key={row.month}>
              <td className="border-b px-3 py-2 text-left" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {row.month}
              </td>
              <td className="border-b px-3 py-2 text-right" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {formatLakhs(row.gst, 1)}
              </td>
              <td className="border-b px-3 py-2 text-right" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {formatLakhs(row.tds, 1)}
              </td>
              <td className="border-b px-3 py-2 text-right" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {formatLakhs(row.pf, 1)}
              </td>
              <td className="border-b px-3 py-2 text-right" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {formatLakhs(row.esi, 1)}
              </td>
              <td className="border-b px-3 py-2 text-right" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {formatLakhs(row.advanceTax, 1)}
              </td>
              <td className="border-b px-3 py-2 text-right font-semibold" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {formatLakhs(row.total, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScenarioSummaryTable({ report }: { report: ManagementReportData }) {
  if (!report.scenarioSummary) {
    return (
      <div
        className="rounded-2xl border border-dashed px-4 py-6 text-center text-xs"
        style={{ borderColor: 'rgba(15, 23, 42, 0.15)', color: REPORT_MUTED_STRONG }}
      >
        Select a scenario in the forecast workspace to include a Base vs Scenario comparison here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: REPORT_BORDER_STRONG }}>
      <table className="w-full border-collapse text-[10px]">
        <thead style={{ backgroundColor: REPORT_SURFACE_STRONG }}>
          <tr>
            <th className="border-b px-3 py-2 text-left font-semibold" style={{ borderColor: REPORT_BORDER_STRONG }}>
              Metric
            </th>
            <th className="border-b px-3 py-2 text-right font-semibold" style={{ borderColor: REPORT_BORDER_STRONG }}>
              Base
            </th>
            <th className="border-b px-3 py-2 text-right font-semibold" style={{ borderColor: REPORT_BORDER_STRONG }}>
              {report.scenarioSummary.scenarioName}
            </th>
          </tr>
        </thead>
        <tbody>
          {report.scenarioSummary.rows.map((row) => (
            <tr key={row.label}>
              <td className="border-b px-3 py-2" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {row.label}
              </td>
              <td className="border-b px-3 py-2 text-right" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {formatLakhs(row.base, 1)}
              </td>
              <td className="border-b px-3 py-2 text-right" style={{ borderColor: REPORT_BORDER_SOFT }}>
                {formatLakhs(row.scenario, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportPage({ children }: { children: React.ReactNode }) {
  return (
    <section
      data-report-page="true"
      className="flex min-h-[1123px] w-[794px] flex-col gap-6 bg-white px-10 py-10 text-black"
    >
      {children}
    </section>
  );
}

function HiddenReportDocument({ report }: { report: ManagementReportData }) {
  return (
    <div className="fixed left-[-20000px] top-0 w-[794px] bg-white text-black">
      <ReportPage>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: REPORT_MUTED }}>
              Management Forecast Report
            </div>
            <h1 className="mt-3 text-3xl font-semibold">{report.companyName}</h1>
            <p className="mt-2 text-sm" style={{ color: REPORT_MUTED_STRONG }}>{report.periodLabel}</p>
          </div>
          {report.logoDataUrl ? (
            <img
              src={report.logoDataUrl}
              alt={`${report.companyName} logo`}
              className="h-16 rounded-2xl border bg-white p-2"
              style={{ borderColor: REPORT_BORDER_STRONG }}
            />
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Revenue', report.executiveSummary.revenue],
            ['Net Profit', report.executiveSummary.netProfit],
            ['Cash on Hand', report.executiveSummary.cashOnHand],
            ['Working Capital Gap', report.executiveSummary.workingCapitalGap],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-3xl border px-5 py-5"
              style={{ borderColor: REPORT_BORDER_STRONG, backgroundColor: REPORT_SURFACE }}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: REPORT_MUTED }}>
                {label}
              </div>
              <div className="mt-2 text-2xl font-semibold">{formatLakhs(value as number, 1)}</div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border px-5 py-5" style={{ borderColor: REPORT_BORDER_STRONG }}>
          <div className="text-sm font-semibold">Executive Summary Notes</div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6" style={{ color: '#334155' }}>
            {report.notes || 'Add commentary in the notes box before downloading the final PDF.'}
          </p>
        </div>
      </ReportPage>

      <ReportPage>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: REPORT_MUTED }}>
            Page 2
          </div>
          <h2 className="mt-2 text-2xl font-semibold">P&amp;L Forecast</h2>
          <p className="mt-2 text-sm" style={{ color: REPORT_MUTED_STRONG }}>All values shown in ₹ Lakhs.</p>
        </div>
        <ReportTable headers={report.forecastMonthLabels} rows={report.pnlRows} />
      </ReportPage>

      <ReportPage>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: REPORT_MUTED }}>
            Page 3
          </div>
          <h2 className="mt-2 text-2xl font-semibold">Balance Sheet + Cash Flow</h2>
        </div>
        <div className="space-y-6">
          <div>
            <div className="mb-3 text-sm font-semibold">Balance Sheet</div>
            <ReportTable headers={report.forecastMonthLabels} rows={report.balanceSheetRows} />
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold">Cash Flow</div>
            <ReportTable headers={report.forecastMonthLabels} rows={report.cashFlowRows} />
          </div>
        </div>
      </ReportPage>

      <ReportPage>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: REPORT_MUTED }}>
            Page 4
          </div>
          <h2 className="mt-2 text-2xl font-semibold">Compliance + Scenarios</h2>
        </div>
        <div className="space-y-6">
          <div>
            <div className="mb-3 text-sm font-semibold">Monthly Compliance Schedule</div>
            <ComplianceTable report={report} />
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold">Scenario Comparison Summary</div>
            <ScenarioSummaryTable report={report} />
          </div>
        </div>
      </ReportPage>
    </div>
  );
}

export function ReportsWorkspace() {
  const reportContainerRef = useRef<HTMLDivElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    accounts,
    baselineResult,
    companyProfile,
    engineResult,
    hasHydrated,
    ready,
    selectedScenario,
  } = useCurrentForecast();

  const reportNotes = useWorkspaceStore((state) => state.reportNotes);
  const logoDataUrl = useWorkspaceStore((state) => state.logoDataUrl);
  const setReportNotes = useWorkspaceStore((state) => state.setReportNotes);

  const report = useMemo(() => {
    if (!engineResult) {
      return null;
    }

    return buildManagementReportData({
      accounts,
      baselineResult,
      companyName: companyProfile.name,
      engineResult,
      forecastMonthLabels: engineResult.forecastMonths,
      logoDataUrl,
      notes: reportNotes,
      selectedScenarioName: selectedScenario?.name ?? null,
    });
  }, [accounts, baselineResult, companyProfile.name, engineResult, logoDataUrl, reportNotes, selectedScenario]);

  if (!hasHydrated) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-3xl bg-muted/60" />
        <div className="h-[420px] animate-pulse rounded-3xl bg-muted/50" />
      </div>
    );
  }

  if (!ready || !engineResult || !report) {
    return (
      <EmptyState
        icon={FileText}
        title="Upload your financial data to see your forecast"
        description="Generate a live forecast first so the management report can pull real P&L, balance sheet, cash flow, and compliance data."
        ctaHref="/data"
        ctaLabel="Start Setup"
      />
    );
  }

  const downloadPdf = async () => {
    setError(null);
    setIsGenerating(true);

    try {
      const reportRoot = reportContainerRef.current;
      const pageNodes = reportRoot?.querySelectorAll<HTMLElement>('[data-report-page="true"]');

      if (!pageNodes?.length) {
        throw new Error('Missing report pages');
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (const [index, node] of Array.from(pageNodes).entries()) {
        const canvas = await html2canvas(node, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          onclone: sanitizeHtml2CanvasClone,
        });

        if (index > 0) {
          pdf.addPage();
        }

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight);
      }

      const blob = pdf.output('blob');
      const filename = `${companyProfile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-forecast-report.pdf`;
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      console.error('Failed to generate PDF report', error);
      setError('Unable to generate PDF report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a 4-page management report with an executive summary, 12-month statements,
            compliance schedule, and scenario comparison.
          </p>
        </div>
        <Button type="button" className="rounded-full" onClick={() => void downloadPdf()} disabled={isGenerating}>
          {isGenerating ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download PDF Report
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Executive Commentary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={reportNotes}
              onChange={(event) => setReportNotes(event.target.value)}
              placeholder="Add CA commentary for management, lenders, or founders. This note appears on the cover page."
              className="min-h-[220px]"
            />
            <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              The PDF uses your company logo from Settings and exports with a white, print-friendly layout.
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Report Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {[
              ['Revenue', report.executiveSummary.revenue],
              ['Net Profit', report.executiveSummary.netProfit],
              ['Cash on Hand', report.executiveSummary.cashOnHand],
              ['Working Capital Gap', report.executiveSummary.workingCapitalGap],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border/80 bg-background/70 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
                <div className="mt-2 text-2xl font-semibold">{formatLakhs(value as number, 1)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div ref={reportContainerRef}>
        <HiddenReportDocument report={report} />
      </div>
    </div>
  );
}
