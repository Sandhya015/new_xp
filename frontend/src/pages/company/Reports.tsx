import { useState } from 'react'
import { BarChart3, Download, TrendingUp, Users, UserCheck, Percent } from 'lucide-react'

/**
 * Company Dashboard — Reports & Analytics (Part 4A §9). Metrics + report types + export. API later.
 */
const METRICS = [
  { label: 'Total Listings', value: '7', sub: 'All time', icon: BarChart3 },
  { label: 'Total Applications', value: '47', sub: 'Across all listings', icon: Users },
  { label: 'Application Conversion Rate', value: '12%', sub: 'Views → Applications', icon: Percent },
  { label: 'Shortlist Rate', value: '25%', sub: 'Applicants shortlisted', icon: UserCheck },
  { label: 'Selection Rate', value: '42%', sub: 'Shortlisted → Selected', icon: TrendingUp },
  { label: 'Offer Acceptance Rate', value: '80%', sub: 'Selected → Accepted', icon: TrendingUp },
  { label: 'Internship Completion Rate', value: '90%', sub: 'Ongoing → Completed', icon: UserCheck },
  { label: 'Avg Applicants / Listing', value: '6.7', sub: 'Per listing', icon: Users },
]

const REPORT_TYPES = [
  'Applicant Summary Report',
  'Listing Performance Report',
  'University-wise Applicant Report',
  'Course & Stream Report',
  'Status-wise Pipeline Report',
  'Monthly Activity Report',
  'Certificate Issuance Report',
]

export function Reports() {
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {METRICS.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-gray">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="mt-2 text-xl font-bold text-brand-navy">{value}</p>
            <p className="mt-0.5 text-xs text-slate-gray">{sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-brand-navy">Select Report</h3>
        <p className="mt-1 text-sm text-slate-gray">Choose a report type and date range. Export as CSV, Excel, or PDF when backend is connected.</p>
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
          Chart / table for &quot;{reportType}&quot; will render here (API wiring later).
        </div>
      </div>
    </div>
  )
}
