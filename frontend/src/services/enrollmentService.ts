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
  pythonQuizPassed?: boolean
  pythonQuizScore?: number
  certificateIssued?: boolean
  certificateNumber?: string | null
  pythonQuizAvailable?: boolean
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
  /** Free enrollment or after manual confirmation (no gateway). */
  async create(payload: { courseId: string; orderId?: string }): Promise<{ id: string; message?: string }> {
    const { data } = await api.post<{ id: string; message?: string }>('/api/enrollments', payload)
    return data
  },
  async submitPythonQuiz(
    courseId: string,
    answers: number[],
  ): Promise<{
    passed: boolean
    scorePercent: number
    passPercent: number
    alreadyCompleted?: boolean
    message?: string
  }> {
    const { data } = await api.post(`/api/enrollments/by-course/${courseId}/python-quiz`, { answers })
    return data
  },
}
