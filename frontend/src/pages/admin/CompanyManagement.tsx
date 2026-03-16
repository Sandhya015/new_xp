import { useState } from 'react'
import { CheckCircle, XCircle, Eye, MessageSquare } from 'lucide-react'

/**
 * Admin — Company Management. Part 5A §10. Approve/reject companies, verified badge, account actions.
 */
const TABS = [
  { id: 'pending', label: 'Pending Approval', count: 3 },
  { id: 'active', label: 'Active', count: 25 },
  { id: 'suspended', label: 'Suspended', count: 0 },
]

const SAMPLE_COMPANIES = [
  { id: '1', name: 'TechSolutions Pvt. Ltd.', industry: 'IT & Software', contactEmail: 'hr@techsolutions.com', registered: '2025-03-01', listings: 0, applicants: 0, status: 'Pending', verified: false },
  { id: '2', name: 'Growth Labs', industry: 'Marketing', contactEmail: 'careers@growthlabs.com', registered: '2025-02-28', listings: 5, applicants: 24, status: 'Active', verified: true },
]

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  Active: 'bg-emerald-100 text-emerald-800',
  Suspended: 'bg-red-100 text-red-800',
}

export function CompanyManagement() {
  const [activeTab, setActiveTab] = useState('pending')

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-lg font-semibold text-brand-navy">Company Management</h2>
      <p className="text-sm text-slate-gray">Review, approve, and manage registered companies. Grant Verified badge, activate/deactivate accounts.</p>

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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Industry</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Contact Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Registered</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Listings</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applicants</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {SAMPLE_COMPANIES.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">
                    {row.name}
                    {row.verified && <span className="ml-1.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800">Verified</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.industry}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.contactEmail}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.registered}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.listings}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.applicants}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Review"><Eye className="h-4 w-4" /></button>
                      {row.status === 'Pending' && (
                        <>
                          <button type="button" className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50" title="Approve"><CheckCircle className="h-4 w-4" /></button>
                          <button type="button" className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Reject"><XCircle className="h-4 w-4" /></button>
                        </>
                      )}
                      <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Request more info"><MessageSquare className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
