import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export type VerifyResult =
  | { valid: true; studentName: string; programName: string; university: string; completionDate: string; certificateId: string }
  | { valid: false; message: string }

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
  /** PDF blob after passing Python course quiz (also emails certificate on first issue). */
  async generateFromQuiz(courseId: string): Promise<Blob> {
    try {
      const res = await api.post<Blob>(
        '/api/certificates/generate-from-quiz',
        { courseId },
        { responseType: 'blob' },
      )
      const ct = String(res.headers['content-type'] || '')
      if (ct.includes('application/json')) {
        const j = JSON.parse(await (res.data as unknown as Blob).text()) as { error?: string }
        throw new Error(j.error || 'Could not generate certificate')
      }
      return res.data as Blob
    } catch (e: unknown) {
      const ax = e as { response?: { data?: Blob } }
      if (ax.response?.data instanceof Blob) {
        const raw = await ax.response.data.text()
        let j: { error?: string }
        try {
          j = JSON.parse(raw) as { error?: string }
        } catch {
          throw new Error('Could not generate certificate')
        }
        throw new Error(j.error || 'Could not generate certificate')
      }
      throw e instanceof Error ? e : new Error('Could not generate certificate')
    }
  },
}
