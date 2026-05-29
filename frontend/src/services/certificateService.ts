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

export type CertificateVerifySuccess = {
  status: true
  valid: true
  certificate_no: string
  certificateId: string
  name: string
  studentName: string
  college_name: string
  university: string
  course: string
  programName: string
  branch: string
  semester: string
  registration_no: string
  domain: string
  mode: string
  start_date: string
  end_date: string
  internship_start_date: string
  internship_end_date: string
  completionDate: string
  marks: string
  attendance: string
  certificate_url: string
  verify_url?: string
  has_uploaded_pdf?: boolean
}

export type CertificateVerifyFailure = {
  status: false
  valid: false
  message: string
  certificate_no?: string
}

export type VerifyResult = CertificateVerifySuccess | CertificateVerifyFailure

function normalizeVerifyPayload(data: Record<string, unknown>): VerifyResult {
  const valid = data.status === true || data.valid === true
  if (!valid) {
    return {
      status: false,
      valid: false,
      message:
        typeof data.message === 'string' && data.message.trim()
          ? data.message
          : 'No certificate found with this certificate number. Please check and try again.',
      certificate_no: typeof data.certificate_no === 'string' ? data.certificate_no : undefined,
    }
  }
  return {
    status: true,
    valid: true,
    certificate_no: String(data.certificate_no || data.certificateId || ''),
    certificateId: String(data.certificateId || data.certificate_no || ''),
    name: String(data.name || data.studentName || ''),
    studentName: String(data.studentName || data.name || ''),
    college_name: String(data.college_name || data.university || ''),
    university: String(data.university || data.college_name || ''),
    course: String(data.course || data.programName || ''),
    programName: String(data.programName || data.course || ''),
    branch: String(data.branch || ''),
    semester: String(data.semester || ''),
    registration_no: String(data.registration_no || ''),
    domain: String(data.domain || data.programName || ''),
    mode: String(data.mode || ''),
    start_date: String(data.start_date || data.internship_start_date || ''),
    end_date: String(data.end_date || data.internship_end_date || data.completionDate || ''),
    internship_start_date: String(data.internship_start_date || data.start_date || ''),
    internship_end_date: String(data.internship_end_date || data.end_date || ''),
    completionDate: String(data.completionDate || data.end_date || ''),
    marks: String(data.marks || ''),
    attendance: String(data.attendance || ''),
    certificate_url: String(data.certificate_url || ''),
    verify_url: typeof data.verify_url === 'string' ? data.verify_url : undefined,
    has_uploaded_pdf: Boolean(data.has_uploaded_pdf),
  }
}

export const certificateService = {
  async verify(certNo: string): Promise<VerifyResult> {
    const certId = (certNo || '').trim()
    if (!certId) {
      return { status: false, valid: false, message: 'Certificate number is required' }
    }
    try {
      const { data } = await api.post<Record<string, unknown>>('/api/verify-certificate', {
        certificate_no: certId,
      })
      return normalizeVerifyPayload(data)
    } catch (err: unknown) {
      try {
        const encoded = encodeURIComponent(certId.toUpperCase())
        const { data } = await api.get<Record<string, unknown>>(`/api/certificates/verify/${encoded}`)
        return normalizeVerifyPayload(data)
      } catch {
        const res =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response
            : null
        const msg = res?.data?.message ?? 'Certificate not found or invalid.'
        return { status: false, valid: false, message: msg }
      }
    }
  },

  async downloadVerifiedPdf(certNo: string): Promise<Blob> {
    const encoded = encodeURIComponent((certNo || '').trim().toUpperCase())
    const base = (getApiBase() || '').replace(/\/$/, '')
    const url = `${base}/api/certificates/verify/${encoded}/pdf`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
      let msg = 'Could not download certificate PDF'
      try {
        const j = (await res.json()) as { error?: string }
        if (j.error) msg = j.error
      } catch {
        /* ignore */
      }
      throw new Error(msg)
    }
    const blob = await res.blob()
    if (!blob || blob.size < 100) throw new Error('Invalid PDF received')
    return blob
  },

  async listMy(): Promise<{
    items: Array<{ id: string; certNo: string; programName: string; university: string; issueDate: string; status: string }>
  }> {
    const { data } = await api.get('/api/certificates/my')
    return data
  },

  async generateFromQuiz(courseId: string): Promise<Blob> {
    const token = useAuthStore.getState().token
    const base = (getApiBase() || '').replace(/\/$/, '')
    const url = `${base}/api/certificates/generate-from-quiz`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ courseId }),
    })
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const j = (await res.json()) as { error?: string }
      throw new Error(j.error || 'Could not generate certificate')
    }
    if (!res.ok) throw new Error('Could not generate certificate')
    const blob = await res.blob()
    if (!blob || blob.size < 100) throw new Error('Invalid or empty certificate file from server.')
    return blob
  },
}
