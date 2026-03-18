import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Download } from 'lucide-react'
import { adminService } from '@/services/adminService'

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'interested', label: 'Interested' },
  { id: 'enrolled', label: 'Enrolled' },
  { id: 'not_interested', label: 'Not Interested' },
  { id: 'no_response', label: 'No Response' },
]

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-blue-100 text-blue-800',
  Contacted: 'bg-amber-100 text-amber-800',
  Interested: 'bg-orange-100 text-orange-800',
  Enrolled: 'bg-emerald-100 text-emerald-800',
  'Not Interested': 'bg-red-100 text-red-800',
  'No Response': 'bg-gray-100 text-gray-800',
}

export function LeadTracker() {
  const [activeTab, setActiveTab] = useState('all')
  const [items, setItems] = useState<Array<{ id: string; name: string; mobile: string; email: string; university: string; course: string; queryType: string; submitted: string; status: string; assignedTo: string }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    adminService.getLeads({ search: search || undefined, status: activeTab === 'all' ? undefined : activeTab })
      .then((res) => { if (!cancelled) setItems(res.items || []) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search, activeTab])

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Lead Management</h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {STATUS_TABS.map((tab) => (
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

      <div className="flex flex-wrap gap-4">
        <input type="search" placeholder="Search by name, mobile, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
          <option value="">Query Type</option>
          <option>Training</option>
          <option>Internship</option>
          <option>General</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="px-4 py-8 text-center text-slate-gray text-sm">Loading leads…</div>
        ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Mobile / Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">University / Course</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Query Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Assigned To</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.mobile} · {row.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.university} · {row.course}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.queryType}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.submitted}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.assignedTo}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/leads/${row.id}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View"><Eye className="h-4 w-4" /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  )
}
