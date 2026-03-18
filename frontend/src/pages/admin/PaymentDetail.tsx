/**
 * Admin — Payment detail (AD-WF-13). View transaction, Mark as Verified (offline), Process Refund, Invoice view/download/regen.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, CheckCircle, Download, RefreshCw } from 'lucide-react'
import { adminService, type PaymentDetail as PaymentDetailType } from '@/services/adminService'

export function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const [payment, setPayment] = useState<PaymentDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundGatewayRef, setRefundGatewayRef] = useState('')

  useEffect(() => {
    if (!id) return
    adminService.getPayment(id).then(setPayment).catch(() => setPayment(null)).finally(() => setLoading(false))
  }, [id])

  const handleVerify = () => {
    if (!id || saving) return
    setSaving(true)
    adminService.verifyPayment(id, {}).then(() => adminService.getPayment(id).then(setPayment)).finally(() => setSaving(false))
  }

  const handleRefund = () => {
    if (!id || !refundReason.trim()) return
    setSaving(true)
    const amount = refundAmount ? parseInt(refundAmount, 10) : undefined
    adminService.refundPayment(id, { reason: refundReason.trim(), amount, gatewayRef: refundGatewayRef || undefined })
      .then(() => adminService.getPayment(id).then(setPayment))
      .then(() => { setShowRefund(false); setRefundReason(''); setRefundAmount(''); setRefundGatewayRef('') })
      .finally(() => setSaving(false))
  }

  if (loading) return <div className="p-6 text-slate-gray">Loading payment…</div>
  if (!payment) return <div className="p-6 text-red-600">Payment not found.</div>

  return (
    <div className="space-y-6 w-full max-w-3xl">
      <div className="flex items-center gap-4">
        <Link to="/admin/payments" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold text-brand-navy">Payment Details</h2>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-brand-navy">{payment.orderId || `Transaction #${id}`}</h3>
              <p className="text-sm text-slate-gray">Status: {payment.status}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {payment.status !== 'success' && payment.status !== 'refunded' && (
              <button type="button" onClick={handleVerify} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <CheckCircle className="h-4 w-4" /> Mark as Verified
              </button>
            )}
            {payment.status !== 'refunded' && (
              <button type="button" onClick={() => setShowRefund(true)} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
                Process Refund
              </button>
            )}
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Download className="h-4 w-4" /> Download Invoice
            </button>
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" /> Re-generate Invoice
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Transaction ID / Gateway Ref</h4>
              <p className="mt-1 text-sm">{payment.orderId || payment.gatewayRef || '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Amount</h4>
              <p className="mt-1 text-sm">₹{payment.amount?.toLocaleString() ?? '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Student</h4>
              <p className="mt-1 text-sm">{payment.studentId || '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Training / Program</h4>
              <p className="mt-1 text-sm">{payment.courseId || '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Timestamp</h4>
              <p className="mt-1 text-sm">{payment.createdAt || '—'}</p>
            </div>
          </div>
          <p className="text-sm text-slate-gray">Manual verify: for offline UPI/bank payments. Process Refund: reason required; optional amount and gateway reference.</p>
        </div>
      </div>

      {showRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Process Refund</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Refund Amount (₹)</label>
                <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder={String(payment.amount ?? '')} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Refund Reason *</label>
                <textarea rows={2} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gateway Refund Reference</label>
                <input type="text" value={refundGatewayRef} onChange={(e) => setRefundGatewayRef(e.target.value)} placeholder="After initiating refund at gateway" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowRefund(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" onClick={handleRefund} disabled={saving || !refundReason.trim()} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">Submit Refund</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
