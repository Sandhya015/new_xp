import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

type CoursesListResponse = { items: unknown[]; total: number; page: number; limit: number }
const LIST_CACHE_TTL_MS = 60_000
let coursesListCache: { key: string; exp: number; data: CoursesListResponse } | null = null

/** Clears the in-memory catalog cache (e.g. after seeding or admin publish). */
export function invalidateCoursesListCache() {
  coursesListCache = null
}

/** Public GET /api/health (no auth). Used to detect local-disk vs S3 course media. */
export type ApiHealthPayload = {
  status: string
  service: string
  courseMediaStorage?: 's3' | 'local' | 'unknown'
}

export async function fetchApiHealth(): Promise<ApiHealthPayload> {
  const base = getApiBase().replace(/\/$/, '')
  const { data } = await axios.get<ApiHealthPayload>(`${base}/api/health`, { withCredentials: false })
  return data
}

function coursesListCacheKey(params?: { page?: number; limit?: number; category?: string; search?: string }) {
  return JSON.stringify({
    page: params?.page ?? 1,
    limit: params?.limit ?? 10,
    category: (params?.category ?? '').trim(),
    search: (params?.search ?? '').trim(),
  })
}

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
  /** Course slug from API (used for completion quiz variant). */
  slug?: string
  /** Same field as marketing page: YouTube/Vimeo or direct video URL. */
  introVideoUrl?: string
  whatYouWillLearn?: string[]
  curriculum?: unknown[]
  classLinks?: Array<{ title?: string; date?: string; time?: string; platform?: string; link?: string; batch?: string }>
  studyMaterials?: Array<{ title?: string; module?: string; type?: string; url?: string }>
  assignments?: Array<{ id?: string; title?: string; dueDate?: string; description?: string }>
  quizzes?: Array<{ title?: string; dueDate?: string }>
  announcements?: Array<{ title?: string; message?: string; createdAt?: string }>
}

/** Public marketing payload from GET /api/courses/:id (extends enrolled content shape where fields overlap). */
export type CoursePublicDetail = CourseContent & {
  slug?: string
  featuredImageUrl?: string
  difficulty?: string
  introVideoUrl?: string
  originalPrice?: number
  whatYouWillLearn?: string[]
  targetAudience?: string
  materialsIncluded?: string[]
  instructions?: string
  trainingTags?: string[]
  marketingCategories?: string[]
  authorName?: string
  listingVisibility?: string
  scheduledPublishAt?: string | null
  enrollmentCount?: number
  updatedAt?: string | null
  batches?: unknown[]
}

export type PythonQuizQuestion = { id: string; question: string; options: string[] }

export const courseService = {
  async list(params?: { page?: number; limit?: number; category?: string; search?: string }) {
    const key = coursesListCacheKey(params)
    const now = Date.now()
    if (coursesListCache && coursesListCache.key === key && now < coursesListCache.exp) {
      return coursesListCache.data
    }
    const { data } = await api.get<CoursesListResponse>('/api/courses', { params })
    // Avoid caching empty catalogs for a long time (e.g. DB seeded after first load).
    const total = typeof data.total === 'number' ? data.total : 0
    if (total > 0) {
      coursesListCache = { key, exp: now + LIST_CACHE_TTL_MS, data }
    } else {
      coursesListCache = null
    }
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
  async getPythonQuiz(courseId: string): Promise<{ passPercent: number; questions: PythonQuizQuestion[] }> {
    const { data } = await api.get<{ passPercent: number; questions: PythonQuizQuestion[] }>(
      `/api/courses/${courseId}/python-quiz`,
    )
    return data
  },
}
