import { useState } from 'react'
import { Eye, Download } from 'lucide-react'

/**
 * Admin — Student Management. Part 5A §9. List students, profile view, account actions.
 */
const SAMPLE_STUDENTS = [
  { id: '1', name: 'Rahul Kumar', email: 'rahul@example.com', mobile: '9876543210', university: 'BEU', course: 'B.Tech CSE', registered: '2025-02-15', status: 'Active' },
  { id: '2', name: 'Priya Sharma', email: 'priya@example.com', mobile: '9876543211', university: 'AKTU', course: 'BCA', registered: '2025-02-10', status: 'Active' },
]

export function StudentList() {
  const [statusFilter, setStatusFilter] = useState('all')

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Student Management</h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
          <option value="">All Universities</option>
        </select>
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
          <option value="">All Courses</option>
        </select>
        <input type="search" placeholder="Search by name, email, mobile..." className="min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Mobile</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">University / Course</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Registered</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {SAMPLE_STUDENTS.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.mobile}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.university} · {row.course}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.registered}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View profile"><Eye className="h-4 w-4" /></button>
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
