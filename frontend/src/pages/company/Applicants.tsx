import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users, FileText, Calendar, XCircle, Download } from 'lucide-react'
import { internshipService, type ApplicationItem } from '@/services/internshipService'

/**
 * Company Dashboard — Applicants (CD-WF-11 to CD-WF-16). Filters, table, actions. API wired.
 */
const STATUS_COLORS: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-800',
  under_review: 'bg-blue-100 text-blue-800',
  shortlisted: 'bg-amber-100 text-amber-800',
  interview_scheduled: 'bg-orange-100 text-orange-800',
  selected: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  not_selected: 'bg-red-100 text-red-800',
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    applied: 'Under Review',
    under_review: 'Under Review',
    shortlisted: 'Shortlisted',
    interview_scheduled: 'Interview Scheduled',
    selected: 'Selected',
    rejected: 'Not Selected',
    not_selected: 'Not Selected',
  }
  return map[s] || s
}

export function Applicants() {
  const [searchParams] = useSearchParams()
  const internshipIdParam = searchParams.get('internshipId') || ''
  const [listingFilter, setListingFilter] = useState(internshipIdParam || 'all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ApplicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    if (internshipIdParam && listingFilter === 'all') setListingFilter(internshipIdParam)
  }, [internshipIdParam, listingFilter])

  useEffect(() => {
    setLoading(true)
    const params: { status?: string; internshipId?: string; search?: string } = {}
    if (statusFilter !== 'all') params.status = statusFilter
    if (listingFilter !== 'all') params.internshipId = listingFilter
    if (search.trim()) params.search = search.trim()
    internshipService
      .listApplications(params)
      .then((res) => setItems(res.items || []))
      .catch(() => setError('Failed to load applicants.'))
      .finally(() => setLoading(false))
  }, [listingFilter, statusFilter, search])

  const handleStatus = (appId: string, newStatus: string) => {
    setActingId(appId)
    setError(null)
    internshipService
      .updateApplication(appId, { status: newStatus })
      .then(() => {
        setItems((prev) => prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a)))
      })
      .catch(() => setError('Action failed. Please try again.'))
      .finally(() => setActingId(null))
  }

  return (
    <div className="space-y-6 w-full">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
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
          {Array.from(new Map(items.map((a) => [a.internshipId, a.internshipTitle || a.internshipId])).entries()).map(([id, title]) => (
            <option key={id} value={id}>{title || id}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        >
          <option value="all">All Status</option>
          <option value="under_review">Under Review</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="interview_scheduled">Interview Scheduled</option>
          <option value="selected">Selected</option>
          <option value="not_selected">Not Selected</option>
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, university..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        />
      </div>

      {loading ? (
        <p className="text-slate-gray py-8">Loading applicants...</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">University / Course</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applied For</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applied On</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <Users className="mx-auto h-12 w-12 text-gray-300" />
                      <p className="mt-2 font-medium text-gray-600">No applicants yet.</p>
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const st = (row.status || 'applied').toLowerCase()
                    const busy = actingId === row.id
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.studentName || row.studentEmail || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-gray">{row.university || '—'} · {row.course || '—'} {row.stream ? ` · ${row.stream}` : ''}</td>
                        <td className="px-4 py-3 text-sm text-slate-gray">{row.internshipTitle || row.internshipId || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-gray">{row.createdAt || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[st] ?? 'bg-gray-100 text-gray-700'}`}>
                            {statusLabel(st)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View Resume"><FileText className="h-4 w-4" /></button>
                            <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View Application">View</button>
                            {(st === 'applied' || st === 'under_review') && (
                              <button type="button" disabled={busy} onClick={() => handleStatus(row.id, 'shortlisted')} className="rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200">Shortlist</button>
                            )}
                            <button type="button" disabled={busy} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Schedule Interview"><Calendar className="h-4 w-4" /></button>
                            {(st === 'shortlisted' || st === 'interview_scheduled') && (
                              <button type="button" disabled={busy} onClick={() => handleStatus(row.id, 'selected')} className="rounded px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200">Select</button>
                            )}
                            <button type="button" disabled={busy} onClick={() => handleStatus(row.id, 'rejected')} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Reject"><XCircle className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
