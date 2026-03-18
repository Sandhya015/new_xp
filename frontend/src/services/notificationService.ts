import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  link?: string
  createdAt: string
}

export const notificationService = {
  async list(params?: { unread?: boolean }): Promise<{ items: NotificationItem[] }> {
    const { data } = await api.get<{ items: NotificationItem[] }>('/api/notifications', {
      params: params?.unread ? { unread: '1' } : undefined,
    })
    return data
  },
}
