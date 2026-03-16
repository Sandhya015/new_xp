import { useState } from 'react'
import { CreditCard, Download, CheckCircle, XCircle, Clock } from 'lucide-react'

/**
 * Admin — Payments & Invoices. Part 5A §7. Overview cards, payment records, refund workflow.
 */
const OVERVIEW_CARDS = [
  { label: 'Total Revenue', value: '₹12.4L', icon: CreditCard },
  { label: 'Successful Payments', value: '1,142', sub: '₹11.8L', icon: CheckCircle },
  { label: 'Failed Payments', value: '28', icon: XCircle },
  { label: 'Pending Payments', value: '5', icon: Clock },
  { label: 'Refunds Issued', value: '12', sub: '₹48K', icon: CreditCard },
]

const SAMPLE_PAYMENTS = [
  { id: 'TXN001', student: 'Rahul Kumar', program: 'Web Dev Bootcamp', amount: '₹4,999', method: 'UPI', date: '2025-03-04 10:30', status: 'Success' },
  { id: 'TXN002', student: 'Priya S.', program: 'Data Science', amount: '₹6,499', method: 'Card', date: '2025-03-03 14:20', status: 'Success' },
]

export function PaymentList() {
  const [statusFilter, setStatusFilter] = useState('all')

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
          <input type="search" placeholder="Search by student, TXN ID..." className="min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Transaction ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Program</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {SAMPLE_PAYMENTS.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.id}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.student}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.program}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.amount}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.method}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.date}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-sm font-medium text-brand-accent hover:underline">View</button>
                    <span className="mx-2 text-gray-300">|</span>
                    <button type="button" className="text-sm font-medium text-slate-gray hover:underline">Invoice</button>
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
