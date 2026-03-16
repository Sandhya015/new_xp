import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { getApiBase } from '@/config/api'

const api = axios.create({
  baseURL: getApiBase(),
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Attach JWT to requests when present
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const authService = {
  async login(email: string, password: string) {
    const { data } = await api.post('/api/auth/login', { email, password })
    return data
  },
  async register(body: { name: string; email: string; password: string; mobile?: string; role?: string; hrName?: string }) {
    const { data } = await api.post('/api/auth/register', body)
    return data
  },
  async me() {
    const { data } = await api.get('/api/auth/me')
    return data
  },
  async refresh() {
    const { data } = await api.post('/api/auth/refresh')
    return data
  },
}
