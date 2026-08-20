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
  const [showVerify, setShowVerify] = useState(false)
  const [verifyNote, setVerifyNote] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundGatewayRef, setRefundGatewayRef] = useState('')
  const [regenReason, setRegenReason] = useState('')
  const [message, setMessage] = useState('')

  const reload = () => {
    if (!id) return Promise.resolve()
    return adminService.getPayment(id).then(setPayment).catch(() => setPayment(null))
  }

  useEffect(() => {
    if (!id) return
    reload().finally(() => setLoading(false))
  }, [id])

  const handleVerify = () => {
    if (!id || saving) return
    setSaving(true)
    setMessage('')
    adminService
      .verifyPayment(id, { reference: verifyNote.trim() || undefined, note: verifyNote.trim() || undefined })
      .then(() => reload())
      .then(() => {
        setShowVerify(false)
        setVerifyNote('')
        setMessage('Payment verified.')
      })
      .catch(() => setMessage('Verify failed.'))
      .finally(() => setSaving(false))
  }

  const handleRefund = () => {
    if (!id || !refundReason.trim()) return
    setSaving(true)
    setMessage('')
    const amount = refundAmount ? parseInt(refundAmount, 10) : undefined
    adminService
      .refundPayment(id, { reason: refundReason.trim(), amount, gatewayRef: refundGatewayRef || undefined })
      .then(() => reload())
      .then(() => {
        setShowRefund(false)
        setRefundReason('')
        setRefundAmount('')
        setRefundGatewayRef('')
        setMessage('Refund recorded.')
      })
      .catch(() => setMessage('Refund failed.'))
      .finally(() => setSaving(false))
  }

  const handleDownload = async () => {
    if (!id || saving) return
    setSaving(true)
    setMessage('')
    try {
      const blob = await adminService.downloadPaymentInvoice(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const txn = (payment?.orderId || id).replace(/[^\w-]+/g, '_')
      const day = new Date().toISOString().slice(0, 10)
      a.download = `Invoice_${txn}_${day}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setMessage('Invoice download failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    if (!id || saving) return
    setSaving(true)
    setMessage('')
    try {
      const res = await adminService.regeneratePaymentInvoice(id, { reason: regenReason.trim() || undefined })
      await reload()
      setMessage(
        res.emailed
          ? `Invoice regenerated (v${res.invoiceVersion}). Email sent to student.`
          : `Invoice regenerated (v${res.invoiceVersion}).`,
      )
      setRegenReason('')
    } catch {
      setMessage('Invoice regenerate failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-gray">Loading payment…</div>
  if (!payment) return <div className="p-6 text-red-600">Payment not found.</div>

  const canInvoice = ['success', 'refunded'].includes((payment.status || '').toLowerCase())

  return (
    <div className="space-y-6 w-full max-w-3xl">
      <div className="flex items-center gap-4">
        <Link to="/admin/payments" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold text-brand-navy">Payment Details</h2>
      </div>

      {message && <p className="text-sm text-slate-gray">{message}</p>}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-brand-navy">{payment.orderId || `Transaction #${id}`}</h3>
              <p className="text-sm text-slate-gray">Status: {payment.status}</p>
              {payment.invoiceNumber ? (
                <p className="text-xs text-slate-gray">
                  Invoice {payment.invoiceNumber}
                  {payment.invoiceVersion ? ` · v${payment.invoiceVersion}` : ''}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {payment.status !== 'success' && payment.status !== 'refunded' && (
              <button
                type="button"
                onClick={() => setShowVerify(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <CheckCircle className="h-4 w-4" /> Mark as Verified
              </button>
            )}
            {payment.status !== 'refunded' && (
              <button
                type="button"
                onClick={() => setShowRefund(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Process Refund
              </button>
            )}
            {canInvoice && (
              <>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" /> Download Invoice
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4" /> Re-generate Invoice
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Transaction ID</h4>
              <p className="mt-1 text-sm">{payment.orderId || '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Gateway Ref</h4>
              <p className="mt-1 text-sm">{payment.gatewayRef || '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Amount</h4>
              <p className="mt-1 text-sm">₹{payment.amount?.toLocaleString('en-IN') ?? '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Payment mode</h4>
              <p className="mt-1 text-sm">{payment.paymentMode || payment.method || '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Student</h4>
              {payment.studentId ? (
                <a
                  href={`/admin/students/${payment.studentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-sm text-brand-accent hover:underline"
                >
                  <span className="font-medium text-brand-navy">{payment.studentName || 'Student'}</span>
                  <br />
                  {payment.studentEmail || payment.studentId}
                  {payment.studentPhone ? ` · ${payment.studentPhone}` : ''}
                </a>
              ) : (
                <p className="mt-1 text-sm">—</p>
              )}
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Training / Program</h4>
              <p className="mt-1 text-sm">{payment.courseTitle || payment.courseId || '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Coupon</h4>
              <p className="mt-1 text-sm">{payment.couponCode || '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Timestamp</h4>
              <p className="mt-1 text-sm">{payment.createdAt || '—'}</p>
            </div>
            {payment.refundReason ? (
              <div className="sm:col-span-2">
                <h4 className="text-xs font-semibold uppercase text-gray-500">Refund</h4>
                <p className="mt-1 text-sm">
                  ₹{(payment.refundAmount ?? payment.amount)?.toLocaleString('en-IN')} — {payment.refundReason}
                  {payment.refundGatewayRef ? ` (${payment.refundGatewayRef})` : ''}
                </p>
              </div>
            ) : null}
          </div>

          {canInvoice && (
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700">Regenerate reason (optional)</label>
              <input
                type="text"
                value={regenReason}
                onChange={(e) => setRegenReason(e.target.value)}
                placeholder="e.g. Corrected billing address"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <p className="text-sm text-slate-gray">
            Manual verify: for offline UPI/bank payments. Process Refund: reason required; optional amount and gateway
            reference. Regenerating an invoice emails the student (PDF only) and BCC admin@xpertintern.com.
          </p>
        </div>
      </div>

      {showVerify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Mark as Verified</h3>
            <p className="mt-1 text-sm text-slate-gray">Optional bank/UPI reference for the audit trail.</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Reference / note</label>
              <input
                type="text"
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="UTR / transaction reference"
              />
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowVerify(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerify}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Confirm verify
              </button>
            </div>
          </div>
        </div>
      )}

      {showRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Process Refund</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Refund Amount (₹)</label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={String(payment.amount ?? '')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Refund Reason *</label>
                <textarea
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gateway Refund Reference</label>
                <input
                  type="text"
                  value={refundGatewayRef}
                  onChange={(e) => setRefundGatewayRef(e.target.value)}
                  placeholder="After initiating refund at gateway"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowRefund(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRefund}
                disabled={saving || !refundReason.trim()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Submit Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
