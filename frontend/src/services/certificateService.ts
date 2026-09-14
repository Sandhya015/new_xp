import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'
import { runBeforeAuthorizedRequest } from '@/lib/attachAuthRefresh'
import { certificateDisplayFromVerify } from '@/lib/certificateFormat'
import { downloadCertificatePdf } from '@/lib/certificatePdfExport'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use(async (config) => {
  await runBeforeAuthorizedRequest(config)
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export type CertificateAssessmentRow = {
  criteria: string
  rating: 'Good' | 'Outstanding'
}

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
  session?: string
  duration?: string
  performanceRating?: string
  issueDate?: string
  start_date: string
  end_date: string
  internship_start_date: string
  internship_end_date: string
  completionDate: string
  marks: string
  attendance: string
  assessmentRows?: CertificateAssessmentRow[]
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
    session: typeof data.session === 'string' ? data.session : '',
    duration: typeof data.duration === 'string' ? data.duration : '',
    performanceRating: typeof data.performanceRating === 'string' ? data.performanceRating : '',
    issueDate: typeof data.issueDate === 'string' ? data.issueDate : '',
    start_date: String(data.start_date || data.internship_start_date || ''),
    end_date: String(data.end_date || data.internship_end_date || data.completionDate || ''),
    internship_start_date: String(data.internship_start_date || data.start_date || ''),
    internship_end_date: String(data.internship_end_date || data.end_date || ''),
    completionDate: String(data.completionDate || data.end_date || ''),
    marks: String(data.marks || ''),
    attendance: String(data.attendance || ''),
    assessmentRows: Array.isArray(data.assessmentRows)
      ? (data.assessmentRows as CertificateAssessmentRow[])
      : undefined,
    certificate_url: String(data.certificate_url || ''),
    verify_url: typeof data.verify_url === 'string' ? data.verify_url : undefined,
    has_uploaded_pdf: Boolean(data.has_uploaded_pdf),
  }
}

async function downloadServerPdf(certNo: string): Promise<Blob> {
  const id = (certNo || '').trim().toUpperCase()
  const base = (getApiBase() || '').replace(/\/$/, '')
  const url = `${base}/api/certificates/verify/pdf?cert_no=${encodeURIComponent(id)}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    let msg = 'Could not download certificate PDF'
    try {
      const j = (await res.json()) as { error?: string; message?: string }
      if (j.error) msg = j.error
      else if (j.message) msg = j.message
    } catch {
      /* ignore */
    }
    if (res.status === 404 && msg === 'Could not download certificate PDF') {
      msg = 'Certificate PDF not found'
    }
    throw new Error(msg)
  }
  const blob = await res.blob()
  if (!blob || blob.size < 100) throw new Error('Invalid PDF received')
  return blob
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function isCertificateDocument(item: { docType?: string; title?: string }): boolean {
  const dt = (item.docType || '').toLowerCase()
  if (dt === 'certificate_generated' || dt === 'certificate') return true
  return (item.title || '').toLowerCase().includes('certificate')
}

export const certificateService = {
  /** Client-rendered PDF blob for a certificate number (skips server PIL template). */
  async pdfBlobForCertNo(certNo: string, options?: { showSignature?: boolean }): Promise<Blob> {
    const verify = await this.verify(certNo)
    if (!verify.valid) throw new Error(verify.message || 'Certificate not found')
    if (verify.has_uploaded_pdf) return downloadServerPdf(certNo)
    const display = certificateDisplayFromVerify(verify)
    const { buildCertificatePdfBlob } = await import('@/lib/certificatePdfExport')
    return buildCertificatePdfBlob(display, { showSignature: options?.showSignature ?? true })
  },

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
        const { data } = await api.get<Record<string, unknown>>('/api/certificates/verify', {
          params: { cert_no: certId.toUpperCase() },
        })
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

  /** Client-rendered PDF (React layout). Falls back to server PDF for custom uploads. */
  async downloadCertificate(
    verify: CertificateVerifySuccess,
    options?: { showSignature?: boolean }
  ): Promise<void> {
    const certNo = verify.certificate_no || verify.certificateId
    const safeName = certNo.replace(/[^\w-]+/g, '_') || 'certificate'
    if (verify.has_uploaded_pdf) {
      const blob = await downloadServerPdf(certNo)
      triggerBlobDownload(blob, `XpertIntern-${safeName}.pdf`)
      return
    }
    const display = certificateDisplayFromVerify(verify)
    await downloadCertificatePdf(display, {
      filename: `XpertIntern-${safeName}.pdf`,
      showSignature: options?.showSignature ?? true,
    })
  },

  async downloadVerifiedPdf(certNo: string): Promise<Blob> {
    const verify = await this.verify(certNo)
    if (!verify.valid) throw new Error(verify.message || 'Certificate not found')
    if (verify.has_uploaded_pdf) return downloadServerPdf(certNo)
    const display = certificateDisplayFromVerify(verify)
    const { buildCertificatePdfBlob } = await import('@/lib/certificatePdfExport')
    return buildCertificatePdfBlob(display, { showSignature: true }) // lazy chunk for html2canvas
  },

  async listMy(): Promise<{
    items: Array<{ id: string; certNo: string; programName: string; university: string; issueDate: string; status: string }>
  }> {
    const { data } = await api.get('/api/certificates/my')
    return data
  },

  async generateFromQuiz(courseId: string): Promise<void> {
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
      body: JSON.stringify({ courseId, clientPdf: true }),
    })
    const ct = res.headers.get('content-type') || ''
    if (!res.ok) {
      if (ct.includes('application/json')) {
        const j = (await res.json()) as { error?: string }
        throw new Error(j.error || 'Could not generate certificate')
      }
      throw new Error('Could not generate certificate')
    }
    const payload = (await res.json()) as { certNo?: string; display?: Record<string, unknown> }
    const displayRaw = payload.display
    if (!displayRaw || displayRaw.valid === false) {
      throw new Error('Could not load certificate details after generation')
    }
    const verify = normalizeVerifyPayload(displayRaw)
    if (!verify.valid) throw new Error(verify.message || 'Could not generate certificate')
    await this.downloadCertificate(verify, { showSignature: true })
  },
}
