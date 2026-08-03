import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, Download, CheckCircle, XCircle, Clock, RotateCcw } from 'lucide-react'
import {
  adminService,
  type PaymentDetail,
  type PaymentFilters,
  type PaymentsSummary,
} from '@/services/adminService'
import { SearchableMultiSelect } from '@/components/admin/SearchableSelect'
import { useAcademicMasters, fetchAdminCoursesForFilter } from '@/hooks/useAcademicMasters'

const FILTERS_KEY = 'admin.payments.lastFilters'

type FilterState = {
  search: string
  status: string
  paymentMode: string
  dateFrom: string
  dateTo: string
  courseIds: string[]
  universities: string[]
  amountMin: string
  amountMax: string
  coupon: string
}

const emptyFilters = (): FilterState => ({
  search: '',
  status: 'all',
  paymentMode: '',
  dateFrom: '',
  dateTo: '',
  courseIds: [],
  universities: [],
  amountMin: '',
  amountMax: '',
  coupon: '',
})

function loadStoredFilters(): FilterState {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (!raw) return emptyFilters()
    const parsed = JSON.parse(raw) as Partial<FilterState> & { courseId?: string; university?: string }
    const base = { ...emptyFilters(), ...parsed }
    // migrate old single-value filters
    if ((!base.courseIds || !base.courseIds.length) && parsed.courseId) {
      base.courseIds = [String(parsed.courseId)]
    }
    if ((!base.universities || !base.universities.length) && parsed.university) {
      base.universities = [String(parsed.university)]
    }
    if (!Array.isArray(base.courseIds)) base.courseIds = []
    if (!Array.isArray(base.universities)) base.universities = []
    return base
  } catch {
    return emptyFilters()
  }
}

function toParams(f: FilterState, page: number, limit: number): PaymentFilters {
  const p: PaymentFilters = { page, limit }
  if (f.search.trim()) p.search = f.search.trim()
  if (f.status && f.status !== 'all') p.status = f.status
  if (f.paymentMode.trim()) p.paymentMode = f.paymentMode.trim()
  if (f.dateFrom) p.dateFrom = f.dateFrom
  if (f.dateTo) p.dateTo = f.dateTo
  if (f.courseIds.length) p.courseIds = f.courseIds.join(',')
  if (f.universities.length) p.universities = f.universities.join(',')
  if (f.amountMin.trim()) p.amountMin = f.amountMin.trim()
  if (f.amountMax.trim()) p.amountMax = f.amountMax.trim()
  if (f.coupon.trim()) p.coupon = f.coupon.trim()
  return p
}

function formatInr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`
}

function statusBadgeClass(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'success') return 'bg-emerald-100 text-emerald-800'
  if (s === 'failed' || s === 'cancelled') return 'bg-red-100 text-red-800'
  if (s === 'refunded') return 'bg-amber-100 text-amber-900'
  return 'bg-slate-100 text-slate-700'
}

export function PaymentList() {
  const { universities } = useAcademicMasters()
  const [filters, setFilters] = useState<FilterState>(() => loadStoredFilters())
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<PaymentDetail[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<PaymentsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkMsg, setBulkMsg] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [courseOptions, setCourseOptions] = useState<Array<{ id: string; title: string }>>([])
  const limit = 50

  useEffect(() => {
    fetchAdminCoursesForFilter().then(setCourseOptions)
  }, [])

  const params = useMemo(() => toParams(filters, page, limit), [filters, page])

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
    } catch {
      /* ignore */
    }
  }, [filters])

  const load = useCallback(() => {
    setLoading(true)
    const listP = adminService.getPayments(params)
    // Summary without status so cards stay meaningful when list is status-filtered
    const summaryParams = { ...params, status: undefined }
    const summaryP = adminService.getPaymentsSummary(summaryParams)

    listP
      .then((listRes) => {
        setItems(listRes.items || [])
        setTotal(listRes.total ?? (listRes.items || []).length)
      })
      .catch(() => {
        setItems([])
        setTotal(0)
      })
      .finally(() => setLoading(false))

    summaryP
      .then((sumRes) => {
        setSummary({
          totalRevenue: Number(sumRes?.totalRevenue ?? 0),
          successfulCount: Number(sumRes?.successfulCount ?? 0),
          failedCount: Number(sumRes?.failedCount ?? 0),
          pendingCount: Number(sumRes?.pendingCount ?? 0),
          refundsSum: Number(sumRes?.refundsSum ?? 0),
          refundsCount: Number(sumRes?.refundsCount ?? 0),
          percentChange: sumRes?.percentChange ?? null,
        })
      })
      .catch(() => {
        // Keep zeros visible instead of em dashes when API fails
        setSummary({
          totalRevenue: 0,
          successfulCount: 0,
          failedCount: 0,
          pendingCount: 0,
          refundsSum: 0,
          refundsCount: 0,
          percentChange: null,
        })
      })
  }, [params])

  useEffect(() => {
    load()
  }, [load])

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setPage(1)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters(emptyFilters())
    setPage(1)
    setSelected(new Set())
  }

  const overviewCards = [
    {
      key: 'revenue',
      label: 'Total Revenue',
      value: formatInr(summary?.totalRevenue ?? 0),
      sub:
        summary?.percentChange != null
          ? `${summary.percentChange >= 0 ? '+' : ''}${summary.percentChange}% vs prior period`
          : '',
      icon: CreditCard,
      status: '',
    },
    {
      key: 'success',
      label: 'Successful Payments',
      value: String(summary?.successfulCount ?? 0),
      sub: '',
      icon: CheckCircle,
      status: 'success',
    },
    {
      key: 'failed',
      label: 'Failed Payments',
      value: String(summary?.failedCount ?? 0),
      sub: '',
      icon: XCircle,
      status: 'failed',
    },
    {
      key: 'pending',
      label: 'Pending Payments',
      value: String(summary?.pendingCount ?? 0),
      sub: '>15 min unpaid',
      icon: Clock,
      status: 'pending',
    },
    {
      key: 'refunds',
      label: 'Refunds Issued',
      value: formatInr(summary?.refundsSum ?? 0),
      sub: `${summary?.refundsCount ?? 0} refunds`,
      icon: RotateCcw,
      status: 'refunded',
    },
  ]

  const allOnPageSelected = items.length > 0 && items.every((r) => selected.has(r.id))

  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        items.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        items.forEach((r) => next.add(r.id))
        return next
      })
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDownload = async () => {
    setBulkBusy(true)
    setBulkMsg('')
    try {
      const ids = Array.from(selected)
      const res = await adminService.bulkDownloadInvoices(
        ids.length
          ? { ids, useFilters: false }
          : { useFilters: true, filters: params },
      )
      if (res.async) {
        setBulkMsg(res.message || `Bulk job queued (${res.jobId || ''}). Check your email.`)
      } else if (res.blob) {
        const url = URL.createObjectURL(res.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `invoices_bulk_${new Date().toISOString().slice(0, 10)}.zip`
        a.click()
        URL.revokeObjectURL(url)
        setBulkMsg(`Downloaded ZIP (${ids.length || 'filtered'} invoices).`)
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: ArrayBuffer | { error?: string } } })?.response?.data
      if (msg instanceof ArrayBuffer) {
        try {
          const j = JSON.parse(new TextDecoder().decode(msg))
          setBulkMsg(j.error || 'Bulk download failed')
        } catch {
          setBulkMsg('Bulk download failed')
        }
      } else if (msg && typeof msg === 'object' && 'error' in msg) {
        setBulkMsg(String((msg as { error?: string }).error || 'Bulk download failed'))
      } else {
        setBulkMsg('Bulk download failed')
      }
    } finally {
      setBulkBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Payments & Invoices</h2>
        <button
          type="button"
          disabled={bulkBusy}
          onClick={handleBulkDownload}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {selected.size ? `Download selected (${selected.size})` : 'Bulk download (filters)'}
        </button>
      </div>
      {bulkMsg && <p className="text-sm text-slate-gray">{bulkMsg}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {overviewCards.map(({ key, label, value, sub, icon: Icon, status }) => (
          <button
            key={key}
            type="button"
            onClick={() => status && setFilter('status', status)}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-left hover:border-brand-accent/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-gray">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="mt-2 text-lg font-bold text-brand-navy">{value}</p>
            {sub ? <p className="text-xs text-slate-gray">{sub}</p> : null}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Payment mode</label>
            <input
              value={filters.paymentMode}
              onChange={(e) => setFilter('paymentMode', e.target.value)}
              placeholder="upi / card / razorpay…"
              className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilter('dateFrom', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilter('dateTo', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <SearchableMultiSelect
            label="Training (title)"
            options={courseOptions.map((c) => ({ value: c.id, label: c.title }))}
            values={filters.courseIds}
            onChange={(v) => setFilter('courseIds', v)}
            placeholder="Select training…"
          />
          <SearchableMultiSelect
            label="University"
            options={universities.map((u) => ({ value: u.value, label: u.label }))}
            values={filters.universities}
            onChange={(v) => setFilter('universities', v)}
            placeholder="Select university…"
          />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount min</label>
            <input
              type="number"
              value={filters.amountMin}
              onChange={(e) => setFilter('amountMin', e.target.value)}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount max</label>
            <input
              type="number"
              value={filters.amountMax}
              onChange={(e) => setFilter('amountMax', e.target.value)}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Coupon</label>
            <input
              value={filters.coupon}
              onChange={(e) => setFilter('coupon', e.target.value)}
              placeholder="yes / no / CODE"
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <input
              type="search"
              placeholder="Name, email, phone, orderId, course title, gateway…"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>

        {loading && <p className="p-4 text-sm text-gray-500">Loading...</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} className="rounded text-brand-accent" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Transaction</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Training</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Coupon</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      className="rounded text-brand-accent"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">
                    <div>{row.orderId || row.id}</div>
                    {row.gatewayRef ? <div className="text-xs text-slate-gray font-normal">{row.gatewayRef}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-gray">
                    {row.studentId ? (
                      <a
                        href={`/admin/students/${row.studentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-accent hover:underline"
                      >
                        <div className="font-medium text-brand-navy">{row.studentName || 'Student'}</div>
                        <div className="text-xs">{row.studentEmail || row.studentId}</div>
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.courseTitle || row.courseId || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.paymentMode || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.couponCode || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{formatInr(row.amount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.createdAt}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/payments/${row.id}`} className="text-sm font-medium text-brand-accent hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                    No payments match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-slate-gray">
          <span>
            {total} total · page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
