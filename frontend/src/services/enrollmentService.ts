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
  status?: string
  batch?: string
  mode?: string
  createdAt: string
  completedAt?: string | null
}

export const enrollmentService = {
  async list(params?: { status?: string }): Promise<{ items: EnrollmentItem[] }> {
    const { data } = await api.get<{ items: EnrollmentItem[] }>('/api/enrollments', { params })
    return data
  },
  async getByCourseId(courseId: string): Promise<EnrollmentItem> {
    const { data } = await api.get<EnrollmentItem>(`/api/enrollments/by-course/${courseId}`)
    return data
  },
}
