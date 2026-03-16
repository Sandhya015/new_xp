import { useState } from 'react'
import { FileText, Award } from 'lucide-react'

/**
 * Company Dashboard — Selected Candidates (Part 4A §8). Status pipeline, actions. API later.
 */
const TABS = ['All', 'Offer Pending', 'Offer Sent', 'Offer Accepted', 'Internship Ongoing', 'Completed', 'Dropped Out']

const SAMPLE_CANDIDATES = [
  { id: '1', name: 'Priya Sharma', internship: 'Data Science Intern', selectionDate: '2025-03-01', status: 'Selected' },
  { id: '2', name: 'Amit Kumar', internship: 'Web Dev Intern', selectionDate: '2025-02-28', status: 'Offer Accepted' },
  { id: '3', name: 'Riya Singh', internship: 'Marketing Intern', selectionDate: '2025-02-20', status: 'Internship Completed' },
]

const STATUS_COLORS: Record<string, string> = {
  Selected: 'bg-emerald-100 text-emerald-800',
  'Offer Letter Sent': 'bg-blue-100 text-blue-800',
  'Offer Accepted': 'bg-teal-100 text-teal-800',
  'Offer Declined': 'bg-red-100 text-red-800',
  'Internship Ongoing': 'bg-amber-100 text-amber-800',
  'Internship Completed': 'bg-violet-100 text-violet-800',
  'Dropped Out': 'bg-gray-100 text-gray-800',
}

export function SelectedCandidates() {
  const [activeTab, setActiveTab] = useState('All')

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-lg font-semibold text-brand-navy">Selected Candidates</h2>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activeTab === tab ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

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
              {SAMPLE_CANDIDATES.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.internship}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.selectionDate}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {row.status === 'Selected' && <button type="button" className="rounded px-2 py-1 text-xs font-medium bg-brand-accent text-white hover:bg-primary-600">Issue Offer Letter</button>}
                      <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View Offer"><FileText className="h-4 w-4" /></button>
                      {row.status === 'Offer Accepted' && <button type="button" className="rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100">Mark Started</button>}
                      {row.status === 'Internship Ongoing' && <button type="button" className="rounded px-2 py-1 text-xs font-medium text-violet-700 bg-violet-100">Mark Completed</button>}
                      {row.status === 'Internship Completed' && <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Issue Certificate"><Award className="h-4 w-4" /></button>}
                      <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View Profile">Profile</button>
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
