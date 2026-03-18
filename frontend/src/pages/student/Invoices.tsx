import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, Download, AlertCircle } from 'lucide-react'
import { paymentService, type OrderItem } from '@/services/paymentService'

/**
 * Student Dashboard — Payments & Invoices (SD-WF-15). API wired.
 */
export function Invoices() {
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    paymentService
      .listMy()
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const pending = items.filter((p) => p.status !== 'success' && p.status !== 'completed')
  const payments = items

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-lg font-semibold text-brand-navy">Payments & Invoices</h2>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium text-amber-900">Pending payment</p>
              <p className="text-sm text-amber-700">Complete payment to confirm enrollment.</p>
            </div>
          </div>
          <button type="button" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            Pay Now
          </button>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3 sm:px-6">
          <h3 className="font-semibold text-brand-navy">Payment History</h3>
          <p className="mt-0.5 text-sm text-slate-gray">All transactions and invoice downloads</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Transaction ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Program</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-gray">Loading...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <CreditCard className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 font-medium text-gray-600">No payments yet.</p>
                    <Link to="/dashboard/training" className="mt-3 inline-block text-sm font-semibold text-brand-accent hover:underline">
                      Explore Training
                    </Link>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{p.transactionId}</td>
                    <td className="px-4 py-3 text-sm text-brand-navy">{p.courseTitle || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">₹{p.amount}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{p.method || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.status === 'success' || p.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent hover:underline">
                        <Download className="h-4 w-4" /> Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
