import axios from 'axios'
import { getApiBase } from '@/config/api'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })

export const paymentService = {
  async createOrder(courseId: string, amount: number, currency = 'INR') {
    const { data } = await api.post('/api/payments/create-order', { courseId, amount, currency })
    return data
  },
  async verify(paymentId: string, orderId: string, signature: string) {
    const { data } = await api.post('/api/payments/verify', { paymentId, orderId, signature })
    return data
  },
  async getInvoice(invoiceId: string) {
    const { data } = await api.get(`/api/payments/invoice/${invoiceId}`)
    return data
  },
}
