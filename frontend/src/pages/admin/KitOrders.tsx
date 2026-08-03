/**
 * Admin — Kit Orders fulfillment (CFRD Rev 2 §1).
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Package, Printer } from 'lucide-react'
import { adminService, type KitOrderRow } from '@/services/adminService'
import { showAppToast } from '@/components/AppToastHost'
import { fetchAdminCoursesForFilter } from '@/hooks/useAcademicMasters'

const STATUSES = ['pending', 'packed', 'dispatched', 'delivered', 'returned', 'cancelled'] as const

function statusClass(s: string) {
  const x = (s || '').toLowerCase()
  if (x === 'pending') return 'bg-amber-100 text-amber-900'
  if (x === 'packed') return 'bg-blue-100 text-blue-800'
  if (x === 'dispatched') return 'bg-indigo-100 text-indigo-800'
  if (x === 'delivered') return 'bg-emerald-100 text-emerald-800'
  if (x === 'returned') return 'bg-orange-100 text-orange-900'
  if (x === 'cancelled') return 'bg-red-100 text-red-800'
  return 'bg-slate-100 text-slate-700'
}

export function KitOrders() {
  const [items, setItems] = useState<KitOrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [courseId, setCourseId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState('pending')
  const [editTracking, setEditTracking] = useState('')
  const limit = 50

  useEffect(() => {
    fetchAdminCoursesForFilter().then(setCourses)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    adminService
      .getKitOrders({
        search: search || undefined,
        status: status || undefined,
        courseId: courseId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit,
      })
      .then((r) => {
        setItems(r.items || [])
        setTotal(r.total ?? 0)
      })
      .catch(() => {
        setItems([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [search, status, courseId, dateFrom, dateTo, page])

  useEffect(() => {
    load()
  }, [load])

  const openStatus = (row: KitOrderRow) => {
    setEditId(row.id)
    setEditStatus(row.status || 'pending')
    setEditTracking(row.trackingNo || '')
  }

  const saveStatus = async () => {
    if (!editId) return
    setBusy(true)
    try {
      await adminService.updateKitOrderStatus(editId, {
        status: editStatus,
        trackingNo: editTracking || undefined,
      })
      showAppToast('Status updated')
      setEditId(null)
      load()
    } catch {
      showAppToast('Update failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = async () => {
    setBusy(true)
    try {
      const blob = await adminService.exportKitOrders({
        search: search || undefined,
        status: status || undefined,
        courseId: courseId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'kit-orders.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showAppToast('Export failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const printLabels = async () => {
    const ids = Array.from(selected)
    if (!ids.length) {
      showAppToast('Select kit orders first', 'error')
      return
    }
    setBusy(true)
    try {
      const blob = await adminService.printKitShippingLabels(ids)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      showAppToast('Label PDF failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy flex items-center gap-2">
            <Package className="h-5 w-5" /> Kit Orders
          </h2>
          <p className="text-sm text-slate-gray">
            {loading ? 'Loading…' : `${total.toLocaleString()} order${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            disabled={busy || !selected.size}
            onClick={printLabels}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> Labels ({selected.size})
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-sm min-w-[180px] flex-1">
          <span className="block text-[11px] font-medium text-gray-600 mb-0.5">Search</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Name, email, kit ID, tracking…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-[11px] font-medium text-gray-600 mb-0.5">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm min-w-[200px]">
          <span className="block text-[11px] font-medium text-gray-600 mb-0.5">Training</span>
          <select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="">All trainings</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[11px] font-medium text-gray-600 mb-0.5">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-[11px] font-medium text-gray-600 mb-0.5">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
        </label>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {loading && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every((r) => selected.has(r.id))}
                    onChange={() => {
                      if (items.every((r) => selected.has(r.id))) {
                        setSelected(new Set())
                      } else {
                        setSelected(new Set(items.map((r) => r.id)))
                      }
                    }}
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600">Kit order</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600">Student</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600">Kit / Training</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600">Ship to</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600">Address type</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600">Ordered</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-gray">
                    No kit orders match these filters.
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(row.id)) next.delete(row.id)
                          else next.add(row.id)
                          return next
                        })
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.kitOrderId || row.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-brand-navy">{row.studentName || '—'}</div>
                    <div className="text-xs text-slate-gray">{row.studentEmail}</div>
                    {row.userId ? (
                      <Link to={`/admin/students/${row.userId}`} className="text-xs text-brand-accent hover:underline">
                        Profile
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div>{row.kitName || 'Training kit'}</div>
                    <div className="text-xs text-slate-gray">{row.courseTitle || row.courseId}</div>
                  </td>
                  <td className="px-3 py-2 text-xs max-w-[180px]">
                    {row.shippingSummary ||
                      [
                        row.shippingAddress?.street || row.shippingAddress?.addressLine1,
                        row.shippingAddress?.city,
                        row.shippingAddress?.state,
                        row.shippingAddress?.pincode,
                      ]
                        .filter(Boolean)
                        .join(', ') ||
                      '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        row.shippingSameAsProfile
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-violet-100 text-violet-800'
                      }`}
                    >
                      {row.shippingSameAsProfile ? 'Same as profile' : 'Custom'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>
                      {row.status}
                    </span>
                    {row.trackingNo ? <div className="text-[10px] text-slate-gray mt-0.5">{row.trackingNo}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-gray">
                    {row.orderedAt ? new Date(row.orderedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openStatus(row)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                    >
                      Update status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span>
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Update kit order status</h3>
            <label className="mt-4 block text-sm">
              <span className="font-medium text-gray-700">Status</span>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-gray-700">Tracking no.</span>
              <input
                value={editTracking}
                onChange={(e) => setEditTracking(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditId(null)} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveStatus}
                className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
