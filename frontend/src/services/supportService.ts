import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export type SupportTicket = {
  id: string
  ticketId: string
  subject: string
  category: string
  description: string
  status: string
  priority: string
  createdAt: string
}

export const supportService = {
  async list(): Promise<{ items: SupportTicket[] }> {
    const { data } = await api.get<{ items: SupportTicket[] }>('/api/support/tickets')
    return data
  },
  async create(payload: { subject: string; category?: string; description: string; priority?: string }): Promise<{ id: string; ticketId: string; message: string }> {
    const { data } = await api.post<{ id: string; ticketId: string; message: string }>('/api/support/tickets', payload)
    return data
  },
}
