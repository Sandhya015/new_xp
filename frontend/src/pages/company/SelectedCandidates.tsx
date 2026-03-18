import { useState, useEffect } from 'react'
import { FileText, Award } from 'lucide-react'
import { internshipService, type ApplicationItem } from '@/services/internshipService'

/**
 * Company Dashboard — Selected Candidates (CD-WF-18). Applications in selected pipeline. API wired.
 */
const SELECTED_PIPELINE_STATUSES = ['selected', 'offer_sent', 'offer_accepted', 'internship_ongoing', 'internship_completed', 'dropped_out']
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'selected', label: 'Offer Pending' },
  { id: 'offer_sent', label: 'Offer Sent' },
  { id: 'offer_accepted', label: 'Offer Accepted' },
  { id: 'internship_ongoing', label: 'Internship Ongoing' },
  { id: 'internship_completed', label: 'Completed' },
  { id: 'dropped_out', label: 'Dropped Out' },
]

const STATUS_COLORS: Record<string, string> = {
  selected: 'bg-emerald-100 text-emerald-800',
  offer_sent: 'bg-blue-100 text-blue-800',
  offer_accepted: 'bg-teal-100 text-teal-800',
  offer_declined: 'bg-red-100 text-red-800',
  internship_ongoing: 'bg-amber-100 text-amber-800',
  internship_completed: 'bg-violet-100 text-violet-800',
  dropped_out: 'bg-gray-100 text-gray-800',
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    selected: 'Selected',
    offer_sent: 'Offer Sent',
    offer_accepted: 'Offer Accepted',
    internship_ongoing: 'Internship Ongoing',
    internship_completed: 'Completed',
    dropped_out: 'Dropped Out',
  }
  return map[s] || s
}

export function SelectedCandidates() {
  const [activeTab, setActiveTab] = useState('all')
  const [items, setItems] = useState<ApplicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    internshipService
      .listApplications()
      .then((res) => {
        const all = res.items || []
        setItems(all.filter((a) => SELECTED_PIPELINE_STATUSES.includes((a.status || '').toLowerCase())))
      })
      .catch(() => setError('Failed to load selected candidates.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = activeTab === 'all' ? items : items.filter((a) => (a.status || '').toLowerCase() === activeTab)

  return (
    <div className="space-y-6 w-full">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      <h2 className="text-lg font-semibold text-brand-navy">Selected Candidates</h2>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activeTab === tab.id ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-gray py-8">Loading...</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Internship</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Selection Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <FileText className="mx-auto h-12 w-12 text-gray-300" />
                      <p className="mt-2 font-medium text-gray-600">No selected candidates in this tab.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const st = (row.status || 'selected').toLowerCase()
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.studentName || row.studentEmail || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-gray">{row.internshipTitle || row.internshipId || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-gray">{row.createdAt || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[st] ?? 'bg-gray-100 text-gray-700'}`}>
                            {statusLabel(st)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {st === 'selected' && <button type="button" className="rounded px-2 py-1 text-xs font-medium bg-brand-accent text-white hover:bg-primary-600">Issue Offer Letter</button>}
                            <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View Offer"><FileText className="h-4 w-4" /></button>
                            {st === 'offer_accepted' && <button type="button" className="rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100">Mark Started</button>}
                            {st === 'internship_ongoing' && <button type="button" className="rounded px-2 py-1 text-xs font-medium text-violet-700 bg-violet-100">Mark Completed</button>}
                            {st === 'internship_completed' && <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Issue Certificate"><Award className="h-4 w-4" /></button>}
                            <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View Profile">Profile</button>
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
