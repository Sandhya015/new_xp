import { useState } from 'react'
import { Users, FileText, Calendar, XCircle, Download } from 'lucide-react'

/**
 * Company Dashboard — Applicants (Part 4A §7). Filters, table, action buttons. API later.
 */
const SAMPLE_APPLICANTS = [
  { id: '1', name: 'Rahul Kumar', university: 'BEU', course: 'B.Tech CSE', semester: '6th', cgpa: '8.2', internship: 'Web Dev Intern', appliedOn: '2025-03-05', status: 'Under Review' },
  { id: '2', name: 'Priya Sharma', university: 'AKTU', course: 'BCA', semester: '5th', cgpa: '9.0', internship: 'Data Science Intern', appliedOn: '2025-03-04', status: 'Shortlisted' },
]

const STATUS_COLORS: Record<string, string> = {
  'Under Review': 'bg-blue-100 text-blue-800',
  Shortlisted: 'bg-amber-100 text-amber-800',
  'Interview Scheduled': 'bg-orange-100 text-orange-800',
  Selected: 'bg-emerald-100 text-emerald-800',
  'Not Selected': 'bg-red-100 text-red-800',
}

export function Applicants() {
  const [listingFilter, setListingFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Applicants</h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        <select
          value={listingFilter}
          onChange={(e) => setListingFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        >
          <option value="all">All Internships</option>
          <option value="1">Web Dev Intern</option>
          <option value="2">Data Science Intern</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        >
          <option value="all">All Status</option>
          <option value="under_review">Under Review</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="selected">Selected</option>
          <option value="not_selected">Not Selected</option>
        </select>
        <input
          type="search"
          placeholder="Search by name, email, university..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">University / Course</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">CGPA</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applied For</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applied On</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {SAMPLE_APPLICANTS.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 font-medium text-gray-600">No applicants yet.</p>
                  </td>
                </tr>
              ) : (
                SAMPLE_APPLICANTS.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.university} · {row.course} {row.semester}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.cgpa}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.internship}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.appliedOn}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View Resume"><FileText className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View Application">View</button>
                        <button type="button" className="rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200">Shortlist</button>
                        <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Schedule Interview"><Calendar className="h-4 w-4" /></button>
                        <button type="button" className="rounded px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200">Select</button>
                        <button type="button" className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Reject"><XCircle className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
