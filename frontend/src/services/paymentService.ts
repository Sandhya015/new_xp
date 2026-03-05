import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const api = axios.create({ baseURL: API_BASE, withCredentials: true })

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
