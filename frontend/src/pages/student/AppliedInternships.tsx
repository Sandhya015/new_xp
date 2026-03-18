import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Briefcase } from 'lucide-react'
import { internshipService, type ApplicationItem } from '@/services/internshipService'

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

/**
 * Student Dashboard — Applied Internships (SD-WF-13). API wired.
 */
export function AppliedInternships() {
  const [items, setItems] = useState<ApplicationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    internshipService
      .myApplications()
      .then((res) => setItems((res.items || []) as ApplicationItem[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 w-full">
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3 sm:px-6">
          <h2 className="text-lg font-semibold text-brand-navy">Your Applications</h2>
          <p className="mt-0.5 text-sm text-slate-gray">Track status of all internship applications</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Internship</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applied On</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-gray">Loading...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <ClipboardList className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 font-medium text-gray-600">You haven&apos;t applied to any internships yet.</p>
                    <Link to="/dashboard/internships" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
                      <Briefcase className="h-4 w-4" /> Explore Internships
                    </Link>
                  </td>
                </tr>
              ) : (
                items.map((app) => {
                  const st = (app.status || 'applied').toLowerCase()
                  return (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-brand-navy">{app.internshipTitle || app.internshipId || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{app.createdAt || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[st] ?? 'bg-gray-100 text-gray-800'}`}>
                          {statusLabel(st)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/internship/${app.internshipId}`} className="text-sm font-medium text-brand-accent hover:underline">
                          View Details
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
