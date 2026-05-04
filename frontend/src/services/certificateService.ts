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

export type VerifyResult =
  | { valid: true; studentName: string; programName: string; university: string; completionDate: string; certificateId: string }
  | { valid: false; message: string }

function isLikelyNetworkFailure(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; message?: string; code?: string }
  const msg = (e.message || '').toLowerCase()
  return (
    e.name === 'TypeError' ||
    msg.includes('network error') ||
    msg.includes('failed to fetch') ||
    e.code === 'ERR_NETWORK'
  )
}

export const certificateService = {
  async verify(certNo: string): Promise<VerifyResult> {
    const certId = (certNo || '').trim().toUpperCase()
    if (!certId) return { valid: false, message: 'Certificate ID is required' }
    try {
      const { data } = await api.get<VerifyResult>(`/api/certificates/verify/${encodeURIComponent(certId)}`)
      return data
    } catch (err: unknown) {
      const res = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { valid?: boolean; message?: string } } }).response : null
      const msg = res?.data?.message ?? 'Certificate not found or invalid.'
      return { valid: false, message: msg }
    }
  },
  async listMy(): Promise<{ items: Array<{ id: string; certNo: string; programName: string; university: string; issueDate: string; status: string }> }> {
    const { data } = await api.get('/api/certificates/my')
    return data
  },
  /**
   * PDF after passing the course completion quiz; server emails a copy when SMTP is configured.
   * Uses fetch (not axios) so large PDF responses are less likely to surface as a false "Network Error".
   */
  async generateFromQuiz(courseId: string): Promise<Blob> {
    const token = useAuthStore.getState().token
    const base = (getApiBase() || '').replace(/\/$/, '')
    const url = `${base}/api/certificates/generate-from-quiz`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ courseId }),
      })
    } catch (e: unknown) {
      if (isLikelyNetworkFailure(e)) {
        throw new Error(
          'CERT_UI_UNCERTAIN|The certificate may still have downloaded or been emailed. Check your downloads folder and inbox.',
        )
      }
      throw e instanceof Error ? e : new Error('Could not generate certificate')
    }

    const ct = res.headers.get('content-type') || ''

    if (ct.includes('application/json')) {
      const j = (await res.json()) as { error?: string }
      throw new Error(j.error || 'Could not generate certificate')
    }

    if (!res.ok) {
      const raw = await res.text()
      let msg = 'Could not generate certificate'
      try {
        const j = JSON.parse(raw) as { error?: string }
        if (typeof j?.error === 'string' && j.error.trim()) msg = j.error.trim()
      } catch {
        if (raw.trim()) msg = raw.trim().slice(0, 280)
      }
      throw new Error(msg)
    }

    const blob = await res.blob()
    if (!blob || blob.size < 100) {
      try {
        const t = await blob.text()
        const j = JSON.parse(t) as { error?: string }
        if (j?.error) throw new Error(j.error)
      } catch {
        /* ignore */
      }
      throw new Error('Invalid or empty certificate file from server.')
    }
    if (blob.type.includes('json')) {
      const j = JSON.parse(await blob.text()) as { error?: string }
      throw new Error(j.error || 'Could not generate certificate')
    }
    return blob
  },
}
