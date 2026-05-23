import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'
import { runBeforeAuthorizedRequest } from '@/lib/attachAuthRefresh'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use(async (config) => {
  await runBeforeAuthorizedRequest(config)
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export type OrderItem = {
  id: string
  /** Primary gateway used for checkout (persisted Mongo `method`). */
  gateway?: 'cashfree' | 'razorpay'
  transactionId: string
  courseId?: string
  courseTitle?: string
  amount: number
  status: string
  method?: string
  createdAt: string
  invoiceNumber?: string
  amountPaise?: number
  razorpayOrderId?: string
}

export type PaymentCreateOrderResponse = {
  gateway: 'cashfree' | 'razorpay'
  internalOrderId: string
  amount: number
  currency: string
  courseTitle?: string
  pricing?: Record<string, unknown>
  keyId?: string
  orderId?: string
  paymentSessionId?: string
  merchantOrderId?: string
  cashfreeEnv?: 'sandbox' | 'production'
}

export type ResumeCheckoutResponse = {
  gateway: 'cashfree' | 'razorpay'
  internalOrderId: string
  amount: number
  currency: string
  courseTitle?: string
  keyId?: string
  orderId?: string
  paymentSessionId?: string
  merchantOrderId?: string
  cashfreeEnv?: 'sandbox' | 'production'
}

export type PaymentVerifyCashfreeResponse = {
  ok: boolean
  message?: string
  enrollmentCreated?: boolean
  invoiceNumber?: string
  orderStatus?: string
  courseId?: string
}

export const paymentService = {
  async listMy(): Promise<{ items: OrderItem[] }> {
    const { data } = await api.get<{ items: OrderItem[] }>('/api/payments/my')
    return data
  },
  /** Amount is determined on the server from the course price — only pass courseId. */
  async createOrder(
    courseId: string,
    opts?: {
      currency?: string
      couponCode?: string
      includeTrainingKit?: boolean
      enrollmentSnapshot?: Record<string, string | undefined>
      billingSnapshot?: Record<string, string | undefined>
    },
  ): Promise<PaymentCreateOrderResponse> {
    const { data } = await api.post<PaymentCreateOrderResponse>('/api/payments/create-order', {
      courseId,
      currency: opts?.currency ?? 'INR',
      couponCode: opts?.couponCode?.trim() || undefined,
      includeTrainingKit: opts?.includeTrainingKit,
      enrollmentSnapshot: opts?.enrollmentSnapshot,
      billingSnapshot: opts?.billingSnapshot,
    })
    return data
  },
  async fetchLastBilling(): Promise<Record<string, string> | null> {
    const { data } = await api.get<{ billingSnapshot: Record<string, string> | null }>('/api/payments/last-billing')
    return data.billingSnapshot
  },
  async verify(paymentId: string, orderId: string, signature: string) {
    const { data } = await api.post('/api/payments/verify', {
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
      razorpay_signature: signature,
    })
    return data
  },
  async verifyCashfree(merchantOrderId: string): Promise<PaymentVerifyCashfreeResponse> {
    try {
      const { data } = await api.post<PaymentVerifyCashfreeResponse>('/api/payments/cashfree/verify', {
        merchantOrderId,
      })
      return data
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
        return e.response.data as PaymentVerifyCashfreeResponse
      }
      throw e
    }
  },
  async resumeCheckout(internalOrderId: string): Promise<ResumeCheckoutResponse> {
    const { data } = await api.post<ResumeCheckoutResponse>('/api/payments/resume-checkout', {
      internalOrderId,
    })
    return data
  },
  async getInvoice(orderId: string, format: 'pdf' | 'html' = 'pdf'): Promise<Blob> {
    const { data } = await api.get(`/api/payments/invoice/${encodeURIComponent(orderId)}`, {
      params: { format },
      responseType: 'blob',
    })
    return data as Blob
  },
}
