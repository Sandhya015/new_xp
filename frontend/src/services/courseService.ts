import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export type CourseContent = {
  id: string
  title: string
  description?: string
  shortDescription?: string
  fullDescription?: string
  category?: string
  duration?: string
  durationValue?: string
  durationUnit?: string
  mode?: string
  universities?: string
  price?: number
  tag?: string
  trainerName?: string
  curriculum?: unknown[]
  classLinks?: Array<{ title?: string; date?: string; time?: string; platform?: string; link?: string; batch?: string }>
  studyMaterials?: Array<{ title?: string; module?: string; type?: string; url?: string }>
  assignments?: Array<{ title?: string; dueDate?: string; description?: string }>
  quizzes?: Array<{ title?: string; dueDate?: string }>
  announcements?: Array<{ title?: string; message?: string; createdAt?: string }>
}

export const courseService = {
  async list(params?: { page?: number; limit?: number; category?: string; search?: string }) {
    const { data } = await api.get<{ items: unknown[]; total: number; page: number; limit: number }>('/api/courses', { params })
    return data
  },
  async getById(id: string) {
    const { data } = await api.get(`/api/courses/${id}`)
    return data
  },
  /** Full content for enrolled student (SD-WF-10). */
  async getContent(courseId: string): Promise<CourseContent> {
    const { data } = await api.get<CourseContent>(`/api/courses/${courseId}/content`)
    return data
  },
}
