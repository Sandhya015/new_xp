import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'
import { runBeforeAuthorizedRequest } from '@/lib/attachAuthRefresh'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use(async (config) => {
  await runBeforeAuthorizedRequest(config)
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export type AssignmentSubmissionItem = {
  assignmentId: string
  assignmentTitle?: string
  text?: string
  fileUrl?: string
  originalFileName?: string
  mimeType?: string
  fileStorageName?: string
  submittedAt?: string
}

export type EnrollmentItem = {
  id: string
  courseId: string
  courseTitle: string
  orderId?: string
  status?: string
  batch?: string
  mode?: string
  createdAt: string
  /** ISO UTC when the student last opened course content (server-updated). */
  lastAccessedAt?: string
  completedAt?: string | null
  pythonQuizPassed?: boolean
  pythonQuizScore?: number
  certificateIssued?: boolean
  certificateNumber?: string | null
  /** Successful PDF streams from generate-from-quiz (max 2). */
  certificatePdfDownloadCount?: number
  certificatePdfDownloadsRemaining?: number
  pythonQuizAvailable?: boolean
  pythonQuizAttemptsUsed?: number
  pythonQuizAttemptsMax?: number
  pythonQuizLastAnswerIndices?: number[]
  pythonQuizLastScorePercent?: number
  /** Server-persisted pass/fail for curriculum Quiz topics (not the completion quiz). */
  curriculumQuizAttempts?: Array<{
    quizTitle: string
    passed: boolean
    scorePercent?: number
    attempts?: number
    attemptsMax?: number
    answerIndices?: number[]
    updatedAt?: string
  }>
  assignmentSubmissions?: AssignmentSubmissionItem[]
  completedCurriculumTopicIds?: string[]
  /** Percent of curriculum topics (with ids) marked complete; null if course has no topics. */
  curriculumProgressPercent?: number | null
  courseFeaturedImageUrl?: string
  courseOriginalPrice?: number
  courseDuration?: string
  courseMode?: string
  courseUniversities?: string
  courseCategory?: string
  courseShortDescription?: string
  enrollmentProfileSnapshot?: Record<string, string> | null
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
  async getAttendanceForCourse(courseId: string) {
    const { data } = await api.get<{
      sessions: Array<{
        sessionKey: string
        title: string
        sessionDate: string
        time: string
        platform: string
        status: string
        note: string
      }>
      summary: { markedSessions: number; attended: number; percent: number | null }
    }>(`/api/enrollments/by-course/${courseId}/attendance`)
    return data
  },
  async setCurriculumTopicComplete(courseId: string, topicId: string, completed: boolean): Promise<EnrollmentItem> {
    const { data } = await api.patch<EnrollmentItem>(`/api/enrollments/by-course/${courseId}/curriculum-topic-complete`, {
      topicId,
      completed,
    })
    return data
  },
  /** Free enrollment or after manual confirmation (no gateway). */
  async create(payload: {
    courseId: string
    orderId?: string
    certificateProfile?: Record<string, string | undefined>
  }): Promise<{ id: string; message?: string }> {
    const { data } = await api.post<{ id: string; message?: string }>('/api/enrollments', payload)
    return data
  },
  async downloadSubmissionFile(fileStorageName: string): Promise<Blob> {
    const { data, headers } = await api.get(
      `/api/enrollments/submission-media/${encodeURIComponent(fileStorageName)}`,
      {
        responseType: 'arraybuffer',
        headers: {
          Accept: 'application/octet-stream, image/jpeg, image/png, application/pdf',
        },
      },
    )
    const raw = headers['content-type']
    const ct = typeof raw === 'string' ? raw.split(';')[0].trim() : 'application/octet-stream'
    return new Blob([data as ArrayBuffer], { type: ct })
  },

  async submitAssignment(
    courseId: string,
    payload: { assignmentId: string; note?: string; file?: File | null },
  ): Promise<EnrollmentItem> {
    const fd = new FormData()
    fd.append('assignmentId', payload.assignmentId)
    if (payload.note?.trim()) fd.append('note', payload.note.trim())
    if (payload.file) fd.append('file', payload.file)
    const { data } = await api.post<EnrollmentItem>(
      `/api/enrollments/by-course/${courseId}/assignment-submissions`,
      fd,
    )
    return data
  },

  async submitCurriculumQuizResult(
    courseId: string,
    body: { quizTitle: string; passed: boolean; scorePercent: number; answers?: number[] },
  ): Promise<EnrollmentItem> {
    const { data } = await api.post<EnrollmentItem>(`/api/enrollments/by-course/${courseId}/curriculum-quiz`, body)
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
    /** True when this submission was a retake after an earlier pass (no duplicate certificate email). */
    retakeAfterPass?: boolean
    /** True when this failed attempt happened after the learner had already passed (pass stays recorded). */
    hadPassRecorded?: boolean
    message?: string
    attemptsUsed?: number
    attemptsMax?: number
    enrollment?: EnrollmentItem
  }> {
    const { data } = await api.post(`/api/enrollments/by-course/${courseId}/python-quiz`, { answers })
    return data
  },
}
