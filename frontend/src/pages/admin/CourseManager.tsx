import { Link } from 'react-router-dom'
import { Plus, Pencil, Eye, Power, PowerOff } from 'lucide-react'

/**
 * Admin — Training Management. Part 5A §5. List trainings, add/edit, curriculum, content, batches.
 */
const SAMPLE_TRAININGS = [
  { id: '1', title: 'Web Development Bootcamp', category: 'Web Dev', university: 'BEU, AKTU', mode: 'Online', duration: '4 weeks', price: '₹4,999', status: 'Active', enrolled: 45 },
  { id: '2', title: 'Data Science Fundamentals', category: 'Data Science', university: 'All', mode: 'Hybrid', duration: '6 weeks', price: '₹6,499', status: 'Active', enrolled: 28 },
  { id: '3', title: 'Digital Marketing', category: 'Marketing', university: 'AKTU', mode: 'Online', duration: '4 weeks', price: '₹3,999', status: 'Draft', enrolled: 0 },
]

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800',
  Draft: 'bg-blue-100 text-blue-800',
  Inactive: 'bg-gray-100 text-gray-800',
}

export function CourseManager() {
  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Training Management</h2>
        <Link
          to="/admin/courses/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" /> Add New Training
        </Link>
      </div>

      <div className="flex flex-wrap gap-4">
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
          <option value="">All Status</option>
          <option>Active</option>
          <option>Draft</option>
          <option>Inactive</option>
        </select>
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
          <option value="">All Universities</option>
        </select>
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
          <option value="">All Categories</option>
        </select>
        <input
          type="search"
          placeholder="Search by title..."
          className="min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">University</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Enrolled</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {SAMPLE_TRAININGS.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.title}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.category}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.university}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.mode}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.duration}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.price}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.enrolled}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View / Manage"><Eye className="h-4 w-4" /></button>
                      <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit"><Pencil className="h-4 w-4" /></button>
                      {row.status === 'Active' && <button type="button" className="rounded p-1.5 text-amber-600 hover:bg-amber-50" title="Deactivate"><PowerOff className="h-4 w-4" /></button>}
                      {row.status !== 'Active' && <button type="button" className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50" title="Activate"><Power className="h-4 w-4" /></button>}
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
