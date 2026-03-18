import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const internshipService = {
  async list(params?: { search?: string }) {
    const { data } = await api.get<{ items: Array<{
      id: string
      title: string
      companyName: string
      domain: string
      duration: string
      type: string
      stipend: string
      deadline: string
      description?: string
      featured?: boolean
    }> }>('/api/internship', { params })
    return data
  },
  async getById(id: string) {
    const { data } = await api.get(`/api/internship/${id}`)
    return data
  },
  async create(payload: Record<string, unknown>) {
    const { data } = await api.post('/api/internship', payload)
    return data
  },
  async apply(internshipId: string) {
    const { data } = await api.post(`/api/internship/${internshipId}/apply`)
    return data
  },
  async myApplications() {
    const { data } = await api.get<{ items: unknown[] }>('/api/internship/applications')
    return data
  },
}
