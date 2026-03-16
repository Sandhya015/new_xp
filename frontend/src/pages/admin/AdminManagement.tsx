import { Plus } from 'lucide-react'

/**
 * Admin — Admin Management (SA Only). Part 5A §13. Create/edit admin accounts, roles, activity log.
 */
const SAMPLE_ADMINS = [
  { id: '1', name: 'Super Admin', email: 'admin@xpertintern.com', role: 'Super Admin', status: 'Active', lastLogin: '2025-03-04 10:30' },
  { id: '2', name: 'John Doe', email: 'john@xpertintern.com', role: 'Admin', status: 'Active', lastLogin: '2025-03-04 09:15' },
]

export function AdminManagement() {
  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Admin Management</h2>
        <button
          type="button"
          onClick={() => {}}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" /> Add Admin
        </button>
      </div>

      <p className="text-sm text-slate-gray">Manage admin staff accounts, roles, and permissions. Super Admin only.</p>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Last Login</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {SAMPLE_ADMINS.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.role}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.lastLogin}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-sm font-medium text-brand-accent hover:underline">Edit Role</button>
                    <span className="mx-2 text-gray-300">|</span>
                    <button type="button" className="text-sm font-medium text-slate-gray hover:underline">Activity Log</button>
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
