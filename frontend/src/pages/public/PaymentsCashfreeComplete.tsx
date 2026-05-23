import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { paymentService } from '@/services/paymentService'
import { showAppToast } from '@/components/AppToastHost'
import { courseContentPath } from '@/utils/courseStudyLink'
import { notifyEnrollmentsChanged } from '@/utils/enrollmentEvents'

/**
 * Landing page after Cashfree full-page redirects (order_meta.return_url).
 * Modal flows call verify inline; this covers _self redirects and in-app browsers.
 */
export function PaymentsCashfreeComplete() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [msg, setMsg] = useState('Confirming payment…')
  const orderRef =
    params.get('order_id')?.trim() ||
    params.get('orderId')?.trim() ||
    params.get('merchant_order_id')?.trim() ||
    params.get('merchantOrderId')?.trim() ||
    ''
  const courseIdHint =
    params.get('courseId')?.trim() || params.get('course_id')?.trim() || ''

  useEffect(() => {
    if (!orderRef) {
      setMsg('Missing payment reference. Return to Payments & Invoices and try Pay now if needed.')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const data = await paymentService.verifyCashfree(orderRef)
        if (cancelled) return
        if (data.ok) {
          showAppToast('Welcome aboard! Your course is now active.')
          notifyEnrollmentsChanged()
          const apiCid =
            typeof (data as { courseId?: string }).courseId === 'string'
              ? (data as { courseId: string }).courseId.trim()
              : ''
          const cid = apiCid || courseIdHint
          if (cid) {
            navigate(courseContentPath(cid), { replace: true })
            return
          }
          navigate('/dashboard/my-courses', { replace: true })
          return
        }
        const m =
          typeof (data as { message?: string }).message === 'string'
            ? (data as { message: string }).message
            : ''
        const st =
          typeof (data as { orderStatus?: string }).orderStatus === 'string'
            ? (data as { orderStatus: string }).orderStatus
            : ''
        setMsg([m || 'Payment status unknown', st && `Cashfree status: ${st}`].filter(Boolean).join(' — ') || '')
      } catch {
        if (!cancelled) setMsg('Could not verify payment. Open Payments & Invoices and retry, or contact support.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orderRef, courseIdHint, navigate])

  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-brand-navy">Processing payment</p>
        <p className="mt-3 text-sm text-slate-gray">{msg}</p>
        <button
          type="button"
          className="mt-6 text-sm font-semibold text-brand-accent hover:underline"
          onClick={() => navigate('/dashboard/payments')}
        >
          Go to Payments &amp; Invoices
        </button>
      </div>
    </div>
  )
}
