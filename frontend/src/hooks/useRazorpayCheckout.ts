import axios from 'axios'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { paymentService } from '@/services/paymentService'
import { enrollmentService } from '@/services/enrollmentService'
import { showAppToast } from '@/components/AppToastHost'
import { loadRazorpayScript } from '@/utils/loadRazorpay'
import { loadCashfreeScript } from '@/utils/loadCashfree'
import { courseContentPath } from '@/utils/courseStudyLink'
import { notifyEnrollmentsChanged } from '@/utils/enrollmentEvents'

type RazorpaySuccessResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export function useRazorpayCheckout() {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  /** Which course is currently in a checkout / enroll flow (only that card should show loading). */
  const [checkoutCourseId, setCheckoutCourseId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startCheckout = useCallback(
    async (opts: {
      courseId: string
      courseTitle: string
      price: number
      prefill?: { name?: string; email?: string; contact?: string }
      onSuccess?: () => void
      couponCode?: string
      includeTrainingKit?: boolean
      enrollmentSnapshot?: Record<string, string | undefined>
      billingSnapshot?: Record<string, string | undefined>
    }) => {
      const {
        courseId,
        courseTitle,
        price,
        prefill,
        onSuccess,
        couponCode,
        includeTrainingKit,
        enrollmentSnapshot,
        billingSnapshot,
      } = opts
      setError(null)

      if (!token) {
        const qs = window.location.pathname + window.location.search
        navigate(`/login?next=${encodeURIComponent(qs)}`)
        return
      }

      if (price <= 0) {
        setCheckoutCourseId(courseId)
        const goToCourse = () => {
          try {
            onSuccess?.()
          } catch {
            /* modal callbacks must not block navigation */
          }
          navigate(courseContentPath(courseId))
        }
        try {
          await enrollmentService.create({
            courseId,
            certificateProfile: enrollmentSnapshot,
          })
          setError(null)
          goToCourse()
          showAppToast('Welcome aboard! Your course is now active.')
        } catch (e: unknown) {
          if (axios.isAxiosError(e) && e.response?.status === 409) {
            setError(null)
            showAppToast('Welcome aboard! Your course is now active.')
            goToCourse()
          } else {
            setError('Could not enroll. Check your connection and try again.')
          }
        } finally {
          setCheckoutCourseId(null)
        }
        return
      }

      setCheckoutCourseId(courseId)
      try {
        const order = await paymentService.createOrder(courseId, {
          couponCode,
          includeTrainingKit,
          enrollmentSnapshot,
          billingSnapshot,
        })

        const gw =
          order.gateway ??
          (order.paymentSessionId && order.merchantOrderId ? 'cashfree' : 'razorpay')

        if (gw === 'cashfree') {
          const loadedCf = await loadCashfreeScript()
          if (!loadedCf || typeof window.Cashfree !== 'function') {
            setError('Could not load payment gateway. Check your connection and try again.')
            setCheckoutCourseId(null)
            return
          }
          const merchantOrderId = order.merchantOrderId
          const paymentSessionId = order.paymentSessionId
          if (!merchantOrderId || !paymentSessionId) {
            setError('Payment gateway misconfigured. Missing Cashfree session.')
            setCheckoutCourseId(null)
            return
          }

          const mode: 'sandbox' | 'production' =
            order.cashfreeEnv === 'sandbox' ? 'sandbox' : 'production'
          const cashfree = window.Cashfree({ mode })
          cashfree
            .checkout({
              paymentSessionId,
              redirectTarget: '_modal',
            })
            .then(async (result) => {
              setCheckoutCourseId(null)
              if (result?.error) {
                setError(
                  typeof result.error?.message === 'string' && result.error.message.trim()
                    ? result.error.message
                    : 'Payment was cancelled.'
                )
                return
              }
              try {
                const v = await paymentService.verifyCashfree(merchantOrderId)
                if (!v.ok) {
                  setError(v.message || 'Payment not confirmed yet. Try again shortly.')
                  return
                }
                showAppToast('Welcome aboard! Your course is now active.')
                notifyEnrollmentsChanged()
                try {
                  onSuccess?.()
                } catch {
                  /* ignore */
                }
                const paidCourseId = v.courseId || courseId
                navigate(courseContentPath(paidCourseId))
              } catch {
                setError(
                  'Payment received but verification failed. Please contact support or check Payments & Invoices.'
                )
              }
            })
            .catch(() => {
              setCheckoutCourseId(null)
              setError('Could not complete payment.')
            })
          return
        }

        const loaded = await loadRazorpayScript()
        if (!loaded || !window.Razorpay) {
          setError('Could not load payment gateway. Check your connection and try again.')
          setCheckoutCourseId(null)
          return
        }

        if (!order.keyId || !order.orderId) {
          setError('Payment gateway misconfigured. Missing Razorpay order.')
          setCheckoutCourseId(null)
          return
        }

        const options: Record<string, unknown> = {
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'XpertIntern',
          description: order.courseTitle || courseTitle,
          order_id: order.orderId,
          handler: async (response: RazorpaySuccessResponse) => {
            try {
              const v = (await paymentService.verify(
                response.razorpay_payment_id,
                response.razorpay_order_id,
                response.razorpay_signature,
              )) as { courseId?: string }
              setCheckoutCourseId(null)
              showAppToast('Welcome aboard! Your course is now active.')
              notifyEnrollmentsChanged()
              try {
                onSuccess?.()
              } catch {
                /* ignore */
              }
              const paidCourseId =
                typeof v.courseId === 'string' && v.courseId.trim() ? v.courseId.trim() : courseId
              navigate(courseContentPath(paidCourseId))
            } catch {
              setError('Payment received but verification failed. Please contact support with your payment ID.')
              setCheckoutCourseId(null)
            }
          },
          prefill: {
            name: prefill?.name || user?.name || '',
            email: prefill?.email || user?.email || '',
            contact: prefill?.contact || '',
          },
          theme: { color: '#2563eb' },
          modal: {
            ondismiss: () => setCheckoutCourseId(null),
          },
        }

        const rzp = new window.Razorpay!(options)
        rzp.on('payment.failed', () => {
          setError('Payment failed or was cancelled.')
          setCheckoutCourseId(null)
        })
        rzp.open()
      } catch (e: unknown) {
        let message = 'Could not start payment. Is the gateway configured on the server?'
        if (axios.isAxiosError(e)) {
          const status = e.response?.status
          const raw = e.response?.data
          const d =
            raw && typeof raw === 'object'
              ? (raw as { error?: string; detail?: string; msg?: string; message?: string })
              : null
          if (status === 401) {
            message = 'Please sign in again, then retry payment.'
          } else if (d) {
            const parts = [d.detail, d.error, d.msg, d.message].filter(
              (x): x is string => typeof x === 'string' && x.trim().length > 0
            )
            if (parts.length) message = parts.join(' — ')
          } else if (e.message) {
            message = e.message
          }
        }
        setError(message)
        setCheckoutCourseId(null)
      }
    },
    [token, user, navigate]
  )

  const abandonCheckout = useCallback(() => {
    setCheckoutCourseId(null)
    setError(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    startCheckout,
    /** True while any course checkout is in progress (single-course pages can use this). */
    busy: checkoutCourseId !== null,
    checkoutCourseId,
    error,
    clearError,
    /** Clears spinner + payment error — call when enrollment modal closes or user cancels checkout. */
    abandonCheckout,
  }
}
