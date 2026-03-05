import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const api = axios.create({ baseURL: API_BASE, withCredentials: true })

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
