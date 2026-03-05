import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// TODO: add response interceptor to refresh JWT and attach token to requests
// api.interceptors.response.use(..., handle 401 refresh)

export const authService = {
  async login(email: string, password: string) {
    const { data } = await api.post('/api/auth/login', { email, password })
    return data
  },
  async register(name: string, email: string, password: string, mobile?: string) {
    const { data } = await api.post('/api/auth/register', { name, email, password, mobile })
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
