import axios from 'axios'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { paymentService } from '@/services/paymentService'
import { enrollmentService } from '@/services/enrollmentService'
import { loadRazorpayScript } from '@/utils/loadRazorpay'

type RazorpaySuccessResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export function useRazorpayCheckout() {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCheckout = useCallback(
    async (opts: {
      courseId: string
      courseTitle: string
      price: number
      prefill?: { name?: string; email?: string; contact?: string }
      onSuccess?: () => void
    }) => {
      const { courseId, courseTitle, price, prefill, onSuccess } = opts
      setError(null)

      if (!token) {
        navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      }

      if (price <= 0) {
        setBusy(true)
        try {
          await enrollmentService.create({ courseId })
          onSuccess?.()
          navigate('/dashboard/my-courses')
        } catch {
          setError('Could not enroll. You may already be enrolled in this course.')
        } finally {
          setBusy(false)
        }
        return
      }

      setBusy(true)
      try {
        const loaded = await loadRazorpayScript()
        if (!loaded || !window.Razorpay) {
          setError('Could not load payment gateway. Check your connection and try again.')
          setBusy(false)
          return
        }

        const order = await paymentService.createOrder(courseId)

        const options: Record<string, unknown> = {
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'XpertIntern',
          description: order.courseTitle || courseTitle,
          order_id: order.orderId,
          handler: async (response: RazorpaySuccessResponse) => {
            try {
              await paymentService.verify(
                response.razorpay_payment_id,
                response.razorpay_order_id,
                response.razorpay_signature
              )
              setBusy(false)
              onSuccess?.()
              navigate('/dashboard/my-courses')
            } catch {
              setError('Payment received but verification failed. Please contact support with your payment ID.')
              setBusy(false)
            }
          },
          prefill: {
            name: prefill?.name || user?.name || '',
            email: prefill?.email || user?.email || '',
            contact: prefill?.contact || '',
          },
          theme: { color: '#2563eb' },
          modal: {
            ondismiss: () => setBusy(false),
          },
        }

        const rzp = new window.Razorpay!(options)
        rzp.on('payment.failed', () => {
          setError('Payment failed or was cancelled.')
          setBusy(false)
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
        setBusy(false)
      }
    },
    [token, user, navigate]
  )

  return { startCheckout, busy, error, clearError: () => setError(null) }
}
