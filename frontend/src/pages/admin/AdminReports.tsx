import { useState } from 'react'
import { BarChart3, Download } from 'lucide-react'

/**
 * Admin — Reports & Analytics. Part 5A §12. Revenue, enrollment, certificate, lead, company reports.
 */
const REPORT_TYPES = [
  'Revenue Report',
  'Enrollment Report',
  'Student Registration Report',
  'Certificate Report',
  'Lead Conversion Report',
  'Company & Internship Report',
  'Payment & Refund Report',
  'Platform Activity Report',
]

export function AdminReports() {
  const [reportType, setReportType] = useState(REPORT_TYPES[0])
  const [dateRange, setDateRange] = useState('last_30_days')

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Reports & Analytics</h2>
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
          >
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="last_90_days">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-brand-navy">Select Report</h3>
        <p className="mt-1 text-sm text-slate-gray">All reports exportable as Excel, CSV, and PDF. Date range filter applies.</p>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="mt-4 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        >
          {REPORT_TYPES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <div className="mt-6 h-48 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-slate-gray text-sm">
          <div className="text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-2">Charts and table for &quot;{reportType}&quot; will render here (API wiring later).</p>
          </div>
        </div>
      </div>
    </div>
  )
}
