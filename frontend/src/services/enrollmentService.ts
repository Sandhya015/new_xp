import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export type EnrollmentItem = {
  id: string
  courseId: string
  courseTitle: string
  orderId?: string
  createdAt: string
}

export const enrollmentService = {
  async list(): Promise<{ items: EnrollmentItem[] }> {
    const { data } = await api.get<{ items: EnrollmentItem[] }>('/api/enrollments')
    return data
  },
}
