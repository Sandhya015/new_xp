import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface InternshipListItem {
  id: string
  title: string
  companyName: string
  companyId?: string
  domain: string
  duration: string
  type: string
  stipend: string
  deadline: string
  description?: string
  requirements?: string
  skills?: string
  location?: string
  openings?: number
  featured?: boolean
  active?: boolean
  status?: string
  createdAt?: string
  applicantsCount?: number
}

export interface ApplicationItem {
  id: string
  studentId: string
  internshipId: string
  status: string
  createdAt: string
  studentName?: string
  studentEmail?: string
  university?: string
  course?: string
  stream?: string
  collegeName?: string
  internshipTitle?: string
}

export const internshipService = {
  async list(params?: { search?: string }) {
    const { data } = await api.get<{ items: InternshipListItem[] }>('/api/internship', { params })
    return data
  },
  /** Company: list my internships (all statuses). Pass status: draft | active | paused | closed | expired to filter. */
  async listMine(params?: { status?: string; search?: string }) {
    const { data } = await api.get<{ items: InternshipListItem[] }>('/api/internship', {
      params: { mine: '1', ...params },
    })
    return data
  },
  async getById(id: string) {
    const { data } = await api.get<InternshipListItem>(`/api/internship/${id}`)
    return data
  },
  async create(payload: Record<string, unknown>) {
    const { data } = await api.post<InternshipListItem>('/api/internship', payload)
    return data
  },
  async update(id: string, payload: Record<string, unknown>) {
    const { data } = await api.patch<InternshipListItem>(`/api/internship/${id}`, payload)
    return data
  },
  async apply(internshipId: string) {
    const { data } = await api.post(`/api/internship/${internshipId}/apply`)
    return data
  },
  async myApplications() {
    const { data } = await api.get<{ items: ApplicationItem[] }>('/api/internship/applications')
    return data
  },
  /** Company: list applications for my internships (enriched). */
  async listApplications(params?: { status?: string; internshipId?: string; search?: string }) {
    const { data } = await api.get<{ items: ApplicationItem[] }>('/api/internship/applications', { params })
    return data
  },
  /** Company: update application status (shortlisted, interview_scheduled, selected, rejected, etc.). */
  async updateApplication(applicationId: string, body: { status?: string; interview?: Record<string, unknown> }) {
    const { data } = await api.patch<ApplicationItem>(`/api/internship/applications/${applicationId}`, body)
    return data
  },
}
