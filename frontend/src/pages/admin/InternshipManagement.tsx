import { useState } from 'react'
import { Briefcase, CheckCircle, XCircle, Star, Eye, Pencil } from 'lucide-react'

/**
 * Admin — Internship Management (Moderation). Part 5A §11. Review company-posted listings.
 */
const TABS = [
  { id: 'pending', label: 'Pending Approval', count: 2 },
  { id: 'active', label: 'Active', count: 45 },
  { id: 'paused', label: 'Paused', count: 3 },
  { id: 'closed', label: 'Closed', count: 20 },
  { id: 'expired', label: 'Expired', count: 5 },
]

const SAMPLE_LISTINGS = [
  { id: '1', title: 'Web Development Intern', company: 'TechSolutions Pvt. Ltd.', category: 'Web Dev', type: 'Remote', posted: '2025-03-04', deadline: '2025-03-25', applicants: 12, status: 'Pending Approval' },
  { id: '2', title: 'Digital Marketing Intern', company: 'Growth Labs', category: 'Marketing', type: 'Hybrid', posted: '2025-03-03', deadline: '2025-03-20', applicants: 0, status: 'Pending Approval' },
]

const STATUS_COLORS: Record<string, string> = {
  'Pending Approval': 'bg-amber-100 text-amber-800',
  Active: 'bg-emerald-100 text-emerald-800',
  Paused: 'bg-gray-100 text-gray-800',
  Closed: 'bg-red-100 text-red-800',
  Expired: 'bg-gray-100 text-gray-600',
}

export function InternshipManagement() {
  const [activeTab, setActiveTab] = useState('pending')

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-lg font-semibold text-brand-navy">Internship Management</h2>
      <p className="text-sm text-slate-gray">Review and moderate company-posted internship listings before they go live.</p>

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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Type</th>
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
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Briefcase className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 font-medium text-gray-600">No listings in this status.</p>
                  </td>
                </tr>
              ) : (
                SAMPLE_LISTINGS.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.company}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.category}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.type}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.posted}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.deadline}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.applicants}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View"><Eye className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50" title="Approve"><CheckCircle className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Reject"><XCircle className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1.5 text-amber-600 hover:bg-amber-50" title="Feature"><Star className="h-4 w-4" /></button>
                        <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit"><Pencil className="h-4 w-4" /></button>
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
