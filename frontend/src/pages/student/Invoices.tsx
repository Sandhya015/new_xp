import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CreditCard, Download, AlertCircle, Loader2 } from 'lucide-react'
import { paymentService, type OrderItem } from '@/services/paymentService'
import { loadRazorpayScript } from '@/utils/loadRazorpay'
import { loadCashfreeScript } from '@/utils/loadCashfree'
import { useAuth } from '@/hooks/useAuth'
import { showAppToast } from '@/components/AppToastHost'
import { courseContentPath } from '@/utils/courseStudyLink'

function isPaidStatus(status: string): boolean {
  const s = status.toLowerCase()
  return s === 'success' || s === 'completed' || s === 'paid'
}

function paymentStatusDisplay(status: string): { label: string; pillClass: string } {
  const s = status.toLowerCase()
  if (isPaidStatus(s)) return { label: 'Paid', pillClass: 'bg-green-100 text-green-800' }
  if (s === 'refunded') return { label: 'Refunded', pillClass: 'bg-violet-100 text-violet-800' }
  if (s === 'failed' || s === 'failure') return { label: 'Failed', pillClass: 'bg-red-100 text-red-800' }
  if (s === 'created' || s === 'pending' || s === 'authorized' || s === 'attempted')
    return { label: 'Pending payment', pillClass: 'bg-amber-100 text-amber-800' }
  return { label: status.replace(/_/g, ' ') || 'Unknown', pillClass: 'bg-gray-100 text-gray-700' }
}

function canResumeCheckout(status: string): boolean {
  const s = status.toLowerCase()
  return s === 'created' || s === 'pending'
}

/**
 * Student Dashboard — Payments & Invoices (S-4): pending checkout resume + readable status.
 */
export function Invoices() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  const loadItems = useCallback(() => {
    return paymentService
      .listMy()
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    loadItems().finally(() => setLoading(false))
  }, [loadItems])

  const pending = items.filter((p) => canResumeCheckout(p.status))
  const historyRows = items

  const onPayNow = async (order: OrderItem) => {
    if (!canResumeCheckout(order.status)) return
    setPayingId(order.id)
    try {
      const session = await paymentService.resumeCheckout(order.id)
      const gw =
        session.gateway ??
        order.gateway ??
        (session.paymentSessionId && session.merchantOrderId ? 'cashfree' : 'razorpay')

      if (gw === 'cashfree') {
        const loadedCf = await loadCashfreeScript()
        if (!loadedCf || typeof window.Cashfree !== 'function') {
          showAppToast('Could not load payment gateway. Try again.')
          setPayingId(null)
          return
        }
        const merchantOrderId = session.merchantOrderId
        const paymentSessionId = session.paymentSessionId
        if (!merchantOrderId || !paymentSessionId) {
          showAppToast('Could not resume Cashfree checkout. Try again from the course page.')
          setPayingId(null)
          return
        }
        const mode: 'sandbox' | 'production' =
          session.cashfreeEnv === 'sandbox' ? 'sandbox' : 'production'
        const cashfree = window.Cashfree({ mode })
        cashfree
          .checkout({
            paymentSessionId,
            redirectTarget: '_modal',
          })
          .then(async (result) => {
            if (result?.error) {
              showAppToast(
                typeof result.error?.message === 'string' && result.error.message.trim()
                  ? result.error.message
                  : 'Payment was cancelled.'
              )
              setPayingId(null)
              return
            }
            try {
              const v = await paymentService.verifyCashfree(merchantOrderId)
              if (!v.ok) {
                showAppToast(v.message || 'Payment not confirmed yet.')
                setPayingId(null)
                return
              }
              showAppToast('Welcome aboard! Your course is now active.')
              await loadItems()
              const cid = v.courseId || order.courseId
              if (cid) navigate(courseContentPath(cid))
            } catch {
              showAppToast('Payment received but verification failed. Contact support with your payment ID.')
            } finally {
              setPayingId(null)
            }
          })
          .catch(() => {
            showAppToast('Could not complete payment.')
            setPayingId(null)
          })
        return
      }

      const loaded = await loadRazorpayScript()
      if (!loaded || !window.Razorpay) {
        showAppToast('Could not load payment gateway. Try again.')
        setPayingId(null)
        return
      }
      if (!session.keyId || !session.orderId) {
        showAppToast('Could not resume Razorpay checkout.')
        setPayingId(null)
        return
      }
      const options: Record<string, unknown> = {
        key: session.keyId,
        amount: session.amount,
        currency: session.currency || 'INR',
        name: 'XpertIntern',
        description: session.courseTitle || order.courseTitle || 'Course payment',
        order_id: session.orderId,
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          try {
            await paymentService.verify(
              response.razorpay_payment_id,
              response.razorpay_order_id,
              response.razorpay_signature,
            )
            showAppToast('Welcome aboard! Your course is now active.')
            await loadItems()
            const cid = order.courseId
            if (cid) navigate(courseContentPath(cid))
          } catch {
            showAppToast('Payment received but verification failed. Contact support with your payment ID.')
          } finally {
            setPayingId(null)
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: (user?.mobile || '').replace(/\D/g, '').slice(-10),
        },
        theme: { color: '#2563eb' },
        modal: {
          ondismiss: () => setPayingId(null),
        },
      }
      const rzp = new window.Razorpay!(options)
      rzp.on('payment.failed', () => {
        showAppToast('Payment failed or was cancelled.')
        setPayingId(null)
      })
      rzp.open()
    } catch {
      showAppToast('Could not resume checkout. Start a new enrollment from the course page if this persists.')
      setPayingId(null)
    }
  }

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-lg font-semibold text-brand-navy">Payments & Invoices</h2>

      {pending.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Pending payments</h3>
          {pending.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">{p.courseTitle || 'Course'}</p>
                  <p className="text-sm text-amber-800">
                    Amount ₹{typeof p.amount === 'number' ? p.amount.toLocaleString('en-IN') : p.amount} ·{' '}
                    {paymentStatusDisplay(p.status).label}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={payingId === p.id}
                onClick={() => void onPayNow(p)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {payingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Pay now
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3 sm:px-6">
          <h3 className="font-semibold text-brand-navy">Payment history</h3>
          <p className="mt-0.5 text-sm text-slate-gray">All transactions and tax invoice downloads</p>
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
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-gray">
                    Loading...
                  </td>
                </tr>
              ) : historyRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <CreditCard className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 font-medium text-gray-600">No payments yet.</p>
                    <Link
                      to="/dashboard/training"
                      className="mt-3 inline-block text-sm font-semibold text-brand-accent hover:underline"
                    >
                      Explore Training
                    </Link>
                  </td>
                </tr>
              ) : (
                historyRows.map((p) => {
                  const st = paymentStatusDisplay(p.status)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">{p.transactionId}</td>
                      <td className="px-4 py-3 text-sm text-brand-navy">{p.courseTitle || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        ₹{typeof p.amount === 'number' ? p.amount.toLocaleString('en-IN') : p.amount}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{p.method || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.pillClass}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPaidStatus(p.status) ? (
                          <button
                            type="button"
                            onClick={() => {
                              paymentService
                                .getInvoice(p.id, 'pdf')
                                .then((blob) => {
                                  const url = URL.createObjectURL(blob)
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = p.invoiceNumber
                                    ? `Tax-Invoice-${p.invoiceNumber.replace(/\//g, '-')}.pdf`
                                    : `invoice-${p.id}.pdf`
                                  a.click()
                                  URL.revokeObjectURL(url)
                                })
                                .catch(() => {})
                            }}
                            className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent hover:underline"
                          >
                            <Download className="h-4 w-4" /> Download
                          </button>
                        ) : canResumeCheckout(p.status) ? (
                          <button
                            type="button"
                            disabled={payingId === p.id}
                            onClick={() => void onPayNow(p)}
                            className="text-sm font-medium text-amber-700 hover:underline disabled:opacity-50"
                          >
                            Pay now
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
