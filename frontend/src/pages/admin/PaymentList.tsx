import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, Download, CheckCircle, XCircle, Clock } from 'lucide-react'
import { adminService } from '@/services/adminService'

const OVERVIEW_CARDS = [
  { label: 'Total Revenue', value: '—', icon: CreditCard },
  { label: 'Successful Payments', value: '—', sub: '', icon: CheckCircle },
  { label: 'Failed Payments', value: '—', icon: XCircle },
  { label: 'Pending Payments', value: '—', icon: Clock },
  { label: 'Refunds Issued', value: '—', sub: '', icon: CreditCard },
]

export function PaymentList() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [items, setItems] = useState<Array<{ id: string; orderId: string; studentId: string; amount: number; status: string; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    adminService.getPayments({ search: search || undefined })
      .then((res) => { if (!cancelled) setItems(res.items || []) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search])

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Payments & Invoices</h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {OVERVIEW_CARDS.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-gray">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="mt-2 text-lg font-bold text-brand-navy">{value}</p>
            {sub && <p className="text-xs text-slate-gray">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
          </select>
          <input type="search" placeholder="Search by student, TXN ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        {loading && <p className="p-4 text-sm text-gray-500">Loading...</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Transaction ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.orderId || row.id}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.studentId || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">₹{row.amount?.toLocaleString('en-IN') ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.createdAt}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/payments/${row.id}`} className="text-sm font-medium text-brand-accent hover:underline">View</Link>
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
