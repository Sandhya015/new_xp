import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export type ReviewStats = {
  average: number
  total: number
  breakdown: Record<string, number>
}

export type ReviewItem = {
  id: string
  courseId: string
  studentName: string
  rating: number
  title: string
  body: string
  createdAt: string | null
  updatedAt: string | null
  helpfulCount: number
  flagged: boolean
}

export type ReviewsListResponse = {
  stats: ReviewStats
  items: ReviewItem[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export const reviewService = {
  async list(courseId: string, params?: { page?: number; limit?: number; sort?: string }) {
    const { data } = await api.get<ReviewsListResponse>('/api/reviews', {
      params: { courseId, ...params },
    })
    return data
  },
  async myReview(courseId: string) {
    const { data } = await api.get<{ review: ReviewItem | null }>('/api/reviews/me', { params: { courseId } })
    return data.review
  },
  async create(payload: { courseId: string; rating: number; title?: string; body: string }) {
    const { data } = await api.post<ReviewItem>('/api/reviews', payload)
    return data
  },
  async update(reviewId: string, payload: { rating: number; title?: string; body: string }) {
    const { data } = await api.put<ReviewItem>(`/api/reviews/${reviewId}`, payload)
    return data
  },
}
