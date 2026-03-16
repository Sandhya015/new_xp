import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks, Plus, Eye, Pencil, Pause, Play, XCircle, Copy, Trash2 } from 'lucide-react'

/**
 * Company Dashboard — Manage Internships (Part 4A §6). Status tabs, table, action buttons. API later.
 */
const TABS = [
  { id: 'all', label: 'All', count: 7 },
  { id: 'active', label: 'Active', count: 3 },
  { id: 'draft', label: 'Draft', count: 1 },
  { id: 'paused', label: 'Paused', count: 1 },
  { id: 'closed', label: 'Closed', count: 2 },
  { id: 'expired', label: 'Expired', count: 0 },
]

const SAMPLE_LISTINGS = [
  { id: '1', title: 'Web Development Intern', category: 'Web Dev', posted: '2025-03-01', deadline: '2025-03-20', applicants: 12, status: 'Active' },
  { id: '2', title: 'Data Science Intern', category: 'Data Science', posted: '2025-02-28', deadline: '2025-03-15', applicants: 8, status: 'Active' },
  { id: '3', title: 'Digital Marketing Intern', category: 'Marketing', posted: '2025-02-20', deadline: '2025-03-10', applicants: 5, status: 'Draft' },
]

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800',
  Draft: 'bg-blue-100 text-blue-800',
  Paused: 'bg-amber-100 text-amber-800',
  Closed: 'bg-red-100 text-red-800',
  Expired: 'bg-gray-100 text-gray-800',
}

export function ManageInternships() {
  const [activeTab, setActiveTab] = useState('all')

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Manage Internships</h2>
        <Link
          to="/company/post-internship"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" /> Post Internship
        </Link>
      </div>

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
            {tab.label} {tab.count > 0 && `(${tab.count})`}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Posted</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Deadline</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applicants</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {SAMPLE_LISTINGS.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <ListChecks className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 font-medium text-gray-600">No internships yet.</p>
                    <Link to="/company/post-internship" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
                      <Plus className="h-4 w-4" /> Post Internship
                    </Link>
                  </td>
                </tr>
              ) : (
                SAMPLE_LISTINGS.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.category}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.posted}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.deadline}</td>
                    <td className="px-4 py-3">
                      <Link to="/company/applicants" className="text-sm font-medium text-brand-accent hover:underline">
                        {row.applicants}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View Details"><Eye className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit"><Pencil className="h-4 w-4" /></button>
                        {row.status === 'Active' && <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Pause"><Pause className="h-4 w-4" /></button>}
                        {row.status === 'Paused' && <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Re-activate"><Play className="h-4 w-4" /></button>}
                        <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Close"><XCircle className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Duplicate"><Copy className="h-4 w-4" /></button>
                        {row.status === 'Draft' && <button type="button" className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Delete"><Trash2 className="h-4 w-4" /></button>}
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
