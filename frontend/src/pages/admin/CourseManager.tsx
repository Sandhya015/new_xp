import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Power, PowerOff, Trash2, RotateCcw } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { showAppToast } from '@/components/AppToastHost'

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800',
  Draft: 'bg-blue-100 text-blue-800',
  Inactive: 'bg-gray-100 text-gray-800',
  Deleted: 'bg-red-100 text-red-800',
}

type CourseRow = {
  id: string
  title: string
  category: string
  universities: string
  mode: string
  duration: string
  price: number
  active: boolean
  deleted?: boolean
}

export function CourseManager() {
  const [items, setItems] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null)
  const [confirmTitle, setConfirmTitle] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    adminService
      .getCourses({
        search: search || undefined,
        status: !showDeleted && status ? status : undefined,
        includeDeleted: showDeleted || undefined,
      })
      .then((res) => setItems((res.items || []) as CourseRow[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [search, status, showDeleted])

  useEffect(() => {
    load()
  }, [load])

  async function toggleActive(row: CourseRow) {
    if (row.deleted) return
    setBusyId(row.id)
    try {
      await adminService.setCourseStatus(row.id, !row.active)
      showAppToast(row.active ? 'Training deactivated' : 'Training activated')
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      showAppToast(msg || 'Could not update status')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      await adminService.deleteCourse(deleteTarget.id, confirmTitle)
      showAppToast('Training soft-deleted')
      setDeleteTarget(null)
      setConfirmTitle('')
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      showAppToast(msg || 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  async function restore(row: CourseRow) {
    setBusyId(row.id)
    try {
      await adminService.restoreCourse(row.id)
      showAppToast('Training restored (inactive). Activate to publish.')
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      showAppToast(msg || 'Restore failed')
    } finally {
      setBusyId(null)
    }
  }

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

      <div className="flex flex-wrap gap-4 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={showDeleted}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
          />
          Show deleted
        </label>
        <input
          type="search"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        />
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((row) => {
                const statusLabel = row.deleted ? 'Deleted' : row.active ? 'Active' : 'Inactive'
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.category}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.universities}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.mode}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{row.duration}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">₹{row.price?.toLocaleString('en-IN') ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[statusLabel] ?? 'bg-gray-100 text-gray-700'}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!row.deleted && (
                          <>
                            <Link
                              to={`/admin/courses/${row.id}/manage`}
                              className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            {row.active ? (
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => toggleActive(row)}
                                className="rounded p-1.5 text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                                title="Deactivate"
                              >
                                <PowerOff className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => toggleActive(row)}
                                className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                title="Activate"
                              >
                                <Power className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => {
                                setDeleteTarget(row)
                                setConfirmTitle('')
                              }}
                              className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {row.deleted && (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => restore(row)}
                            className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            title="Restore"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-brand-navy">Delete training?</h3>
            <p className="text-sm text-slate-gray">
              Soft delete keeps the record for reports and refunds. Type the training title to confirm:
              <span className="font-medium text-brand-navy"> {deleteTarget.title}</span>
            </p>
            <input
              type="text"
              value={confirmTitle}
              onChange={(e) => setConfirmTitle(e.target.value)}
              placeholder="Type training title"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                onClick={() => {
                  setDeleteTarget(null)
                  setConfirmTitle('')
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === deleteTarget.id || confirmTitle.trim().toLowerCase() !== deleteTarget.title.trim().toLowerCase()}
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
