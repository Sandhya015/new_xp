import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const adminService = {
  async getStudents(params?: { search?: string }) {
    const { data } = await api.get<{ items: Array<{ id: string; name: string; email: string; mobile: string; university: string; course: string; registered: string; status: string }> }>('/api/admin/students', { params })
    return data
  },
  async getLeads(params?: { search?: string; status?: string }) {
    const { data } = await api.get<{ items: Array<{ id: string; name: string; mobile: string; email: string; university: string; course: string; queryType: string; submitted: string; status: string; assignedTo: string }> }>('/api/admin/leads', { params })
    return data
  },
  async getPayments(params?: { search?: string }) {
    const { data } = await api.get<{ items: Array<{ id: string; orderId: string; studentId: string; amount: number; status: string; createdAt: string }> }>('/api/admin/payments', { params })
    return data
  },
  async getCourses(params?: { search?: string }) {
    const { data } = await api.get<{ items: unknown[] }>('/api/admin/courses', { params })
    return data
  },
  async createCourse(payload: Record<string, unknown>) {
    const { data } = await api.post('/api/admin/courses', payload)
    return data
  },
}
