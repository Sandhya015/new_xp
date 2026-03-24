import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export type OrderItem = {
  id: string
  transactionId: string
  courseId?: string
  courseTitle?: string
  amount: number
  status: string
  method?: string
  createdAt: string
}

export const paymentService = {
  async listMy(): Promise<{ items: OrderItem[] }> {
    const { data } = await api.get<{ items: OrderItem[] }>('/api/payments/my')
    return data
  },
  /** Amount is determined on the server from the course price — only pass courseId. */
  async createOrder(courseId: string, currency = 'INR'): Promise<{
    keyId: string
    orderId: string
    amount: number
    currency: string
    courseTitle?: string
    internalOrderId?: string
  }> {
    const { data } = await api.post('/api/payments/create-order', { courseId, currency })
    return data
  },
  async verify(paymentId: string, orderId: string, signature: string) {
    const { data } = await api.post('/api/payments/verify', {
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
      razorpay_signature: signature,
    })
    return data
  },
  async getInvoice(invoiceId: string) {
    const { data } = await api.get(`/api/payments/invoice/${invoiceId}`)
    return data
  },
}
