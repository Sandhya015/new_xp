import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'
import { runBeforeAuthorizedRequest } from '@/lib/attachAuthRefresh'

const api = axios.create({
  baseURL: getApiBase(),
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})
api.interceptors.request.use(async (config) => {
  await runBeforeAuthorizedRequest(config)
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const partnerService = {
  async meta() {
    const { data } = await api.get<{
      partnerTypes: string[]
      audienceSizes: string[]
      hearAbout: string[]
      recaptchaSiteKey?: string
      recaptchaEnabled?: boolean
    }>('/api/partners/meta')
    return data
  },
  async sendOtp(channel: 'email' | 'phone', target: string) {
    const { data } = await api.post<{ verificationId: string }>('/api/partners/otp/send', { channel, target })
    return data
  },
  async verifyOtp(verificationId: string, otp: string) {
    const { data } = await api.post<{ ok: boolean }>('/api/partners/otp/verify', { verificationId, otp })
    return data
  },
  async apply(body: Record<string, unknown>) {
    const { data } = await api.post<{ applicationId: string; message: string }>('/api/partners/apply', body)
    return data
  },
  async status(applicationId: string, email: string) {
    const { data } = await api.post<{ application: Record<string, unknown> }>('/api/partners/status', {
      applicationId,
      email,
    })
    return data
  },
  async reply(token: string, message: string) {
    const { data } = await api.post<{ ok: boolean; message: string }>('/api/partners/reply', { token, message })
    return data
  },
  async me() {
    const { data } = await api.get('/api/partners/me')
    return data as {
      partner: Record<string, unknown>
      stats: Record<string, number | Array<{ date: string; value: number }>>
      unreadNotifications?: number
    }
  },
  async notifications() {
    const { data } = await api.get<{ items: Array<Record<string, unknown>> }>('/api/partners/me/notifications')
    return data
  },
  async markNotificationsRead(all = true, ids?: string[]) {
    const { data } = await api.post('/api/partners/me/notifications/read', { all, ids })
    return data
  },
  async links() {
    const { data } = await api.get<{ items: Array<Record<string, unknown>> }>('/api/partners/me/links')
    return data
  },
  async coupons() {
    const { data } = await api.get<{ items: Array<Record<string, unknown>> }>('/api/partners/me/coupons')
    return data
  },
  async referrals() {
    const { data } = await api.get('/api/partners/me/referrals')
    return data as { items: Array<Record<string, unknown>>; stats: Record<string, number> }
  },
  async payouts() {
    const { data } = await api.get('/api/partners/me/payouts')
    return data as { items: Array<Record<string, unknown>>; stats: Record<string, number> }
  },
  payoutReceiptUrl(payoutId: string) {
    return `${getApiBase()}/api/partners/me/payouts/${encodeURIComponent(payoutId)}/receipt`
  },
  async updateProfile(body: Record<string, unknown>) {
    const { data } = await api.put('/api/partners/me/profile', body)
    return data
  },
  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await api.post('/api/partners/me/password', { currentPassword, newPassword })
    return data
  },
  async supportTicket(subject: string, message: string) {
    const { data } = await api.post<{ ok: boolean; ticketId?: string; message?: string }>(
      '/api/partners/me/support',
      { subject, message },
    )
    return data
  },
  async marketingKit() {
    const { data } = await api.get('/api/partners/me/marketing-kit')
    return data as { items: Array<Record<string, unknown>>; mainReferralUrl: string }
  },
}

export const adminPartnerService = {
  async pendingMeta() {
    const { data } = await api.get<{ pendingApplications: number; trainings: Array<{ id: string; title: string }> }>(
      '/api/admin/partners/meta',
    )
    return data
  },
  async listApplications(params?: Record<string, string>) {
    const { data } = await api.get<{ items: Array<Record<string, unknown>>; pendingCount: number }>(
      '/api/admin/partners/applications',
      { params },
    )
    return data
  },
  applicationsExportUrl(params?: Record<string, string>) {
    const q = new URLSearchParams(params || {}).toString()
    return `${getApiBase()}/api/admin/partners/applications/export${q ? `?${q}` : ''}`
  },
  async bulkReject(ids: string[], reason: string) {
    const { data } = await api.post('/api/admin/partners/applications/bulk-reject', { ids, reason })
    return data
  },
  async addNote(id: string, note: string) {
    const { data } = await api.post(`/api/admin/partners/applications/${id}/notes`, { note })
    return data
  },
  async getApplication(id: string) {
    const { data } = await api.get<{ application: Record<string, unknown> }>(`/api/admin/partners/applications/${id}`)
    return data
  },
  async approve(id: string, body: Record<string, unknown>) {
    const { data } = await api.post(`/api/admin/partners/applications/${id}/approve`, body)
    return data
  },
  async reject(id: string, body: Record<string, unknown>) {
    const { data } = await api.post(`/api/admin/partners/applications/${id}/reject`, body)
    return data
  },
  async requestInfo(id: string, question: string) {
    const { data } = await api.post(`/api/admin/partners/applications/${id}/request-info`, { question })
    return data
  },
  async listPartners(params?: Record<string, string>) {
    const { data } = await api.get<{ items: Array<Record<string, unknown>> }>('/api/admin/partners', { params })
    return data
  },
  async createPartner(body: Record<string, unknown>) {
    const { data } = await api.post('/api/admin/partners', body)
    return data
  },
  async getPartner(id: string) {
    const { data } = await api.get(`/api/admin/partners/${id}`)
    return data as {
      partner: Record<string, unknown>
      stats: Record<string, number | Array<{ date: string; value: number }>>
      links: Array<Record<string, unknown>>
      coupons: Array<Record<string, unknown>>
      activity?: Array<Record<string, unknown>>
      payouts?: Array<Record<string, unknown>>
      referrals?: Array<Record<string, unknown>>
    }
  },
  async updatePartner(id: string, body: Record<string, unknown>) {
    const { data } = await api.put(`/api/admin/partners/${id}`, body)
    return data
  },
  async createLink(partnerId: string, body: Record<string, unknown>) {
    const { data } = await api.post(`/api/admin/partners/${partnerId}/links`, body)
    return data
  },
  async createCoupon(partnerId: string, body: Record<string, unknown>) {
    const { data } = await api.post(`/api/admin/partners/${partnerId}/coupons`, body)
    return data
  },
  async eligiblePayouts() {
    const { data } = await api.get<{ items: Array<Record<string, unknown>> }>('/api/admin/partners/payouts/eligible')
    return data
  },
  async processPayouts(partnerIds: string[], transactionRef: string, method = 'upi') {
    const { data } = await api.post('/api/admin/partners/payouts/process', { partnerIds, transactionRef, method })
    return data
  },
}
