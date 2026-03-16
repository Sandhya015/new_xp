import axios from 'axios'
import { getApiBase } from '@/config/api'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })

export const courseService = {
  async list(params?: { page?: number; limit?: number; category?: string }) {
    const { data } = await api.get('/api/courses', { params })
    return data
  },
  async getById(id: string) {
    const { data } = await api.get(`/api/courses/${id}`)
    return data
  },
}
