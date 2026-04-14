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
  async register(body: Record<string, unknown>) {
    const { data } = await api.post('/api/auth/register', body)
    return data as {
      message?: string
      verificationId?: string
      expiresInSeconds?: number
      token?: string
      user?: unknown
    }
  },
  async verifyRegisterOtp(verificationId: string, otp: string) {
    const { data } = await api.post('/api/auth/register/verify-otp', { verificationId, otp })
    return data as { message?: string; token: string; user: unknown }
  },
  async resendRegisterOtp(verificationId: string) {
    const { data } = await api.post('/api/auth/register/resend-otp', { verificationId })
    return data as { message?: string; verificationId?: string; retryAfterSeconds?: number }
  },
  async companyRegister(body: Record<string, unknown>) {
    const { data } = await api.post('/api/auth/company/register', body)
    return data as { message?: string; verificationId?: string; expiresInSeconds?: number }
  },
  async companyVerifyRegisterOtp(verificationId: string, otp: string) {
    const { data } = await api.post('/api/auth/company/register/verify-otp', { verificationId, otp })
    return data as { message?: string }
  },
  async companyResendRegisterOtp(verificationId: string) {
    const { data } = await api.post('/api/auth/company/register/resend-otp', { verificationId })
    return data as { message?: string; retryAfterSeconds?: number }
  },
  async forgotPassword(email: string) {
    const { data } = await api.post('/api/auth/forgot-password', { email })
    return data as { message?: string }
  },
  async resetPassword(body: { token: string; newPassword: string; confirmPassword: string }) {
    const { data } = await api.post('/api/auth/reset-password', body)
    return data as { message?: string }
  },
  async me() {
    const { data } = await api.get('/api/auth/me')
    return data
  },
  async updateProfile(payload: Record<string, string | number | null | undefined>) {
    const { data } = await api.patch('/api/auth/me', payload)
    return data
  },
  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await api.post('/api/auth/change-password', {
      currentPassword,
      newPassword,
    })
    return data
  },
  async refresh() {
    const { data } = await api.post('/api/auth/refresh')
    return data
  },
}
