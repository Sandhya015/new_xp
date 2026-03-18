import axios from 'axios'
import { getApiBase } from '@/config/api'

const api = axios.create({ baseURL: getApiBase() })

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
}
