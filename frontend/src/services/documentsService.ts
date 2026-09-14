import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'
import { runBeforeAuthorizedRequest } from '@/lib/attachAuthRefresh'
import { certificateService, isCertificateDocument } from '@/services/certificateService'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use(async (config) => {
  await runBeforeAuthorizedRequest(config)
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Decode PDF bytes (handles API Gateway base64 bodies). */
function pdfBlobFromArrayBuffer(buffer: ArrayBuffer): Blob {
  const u8 = new Uint8Array(buffer)
  const isPdf = u8.length >= 4 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46
  if (isPdf) return new Blob([buffer], { type: 'application/pdf' })

  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer).trim()
  if (text.startsWith('{')) {
    try {
      const j = JSON.parse(text) as { error?: string }
      throw new Error(j.error || 'PDF not available')
    } catch (e) {
      if (e instanceof Error && e.message !== 'Unexpected token') throw e
    }
  }

  const cleaned = text.replace(/\s/g, '')
  if (cleaned.length >= 8 && /^[A-Za-z0-9+/=]+$/.test(cleaned.slice(0, Math.min(500, cleaned.length)))) {
    try {
      const bin = atob(cleaned)
      const out = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
      if (out.length >= 4 && out[0] === 0x25 && out[1] === 0x50 && out[2] === 0x44 && out[3] === 0x46) {
        return new Blob([out], { type: 'application/pdf' })
      }
    } catch {
      /* fall through */
    }
  }

  throw new Error('Invalid PDF response from server')
}

export type DocumentItem = {
  id: string
  studentId: string
  courseId: string
  enrollmentId: string
  docType: string
  docVariant?: string
  letterNo?: string
  title: string
  studentName: string
  courseTitle: string
  status: string
  emailSentAt?: string | null
  createdAt?: string | null
  certificateId?: string
}

export type EnrolledStudentRow = {
  userId: string
  enrollmentId: string
  batch: string
  mode: string
  profile: Record<string, string>
}

export const documentsService = {
  async hubCounts() {
    const { data } = await api.get<{ counts: Record<string, number> }>('/api/admin/documents/hub')
    return data.counts
  },

  async enrolledStudents(courseId: string, params?: { university?: string; college?: string; q?: string }) {
    const { data } = await api.get<{ students: EnrolledStudentRow[] }>('/api/admin/documents/enrolled-students', {
      params: { courseId, ...params },
    })
    return data.students
  },

  async generateOfferLetter(payload: {
    courseId: string
    variant: string
    studentIds: string[]
    inputs: Record<string, unknown>
  }) {
    const { data } = await api.post('/api/admin/documents/offer-letter/generate', payload)
    return data
  },

  async generateIdCard(payload: { courseId: string; variant: string; studentIds: string[] }) {
    const { data } = await api.post('/api/admin/documents/id-card/generate', payload)
    return data
  },

  async generateLogbook(payload: {
    courseId: string
    variant: string
    studentIds: string[]
    inputs: Record<string, unknown>
  }) {
    const { data } = await api.post('/api/admin/documents/logbook/generate', payload)
    return data
  },

  async generateAttendanceLog(payload: {
    courseId: string
    studentIds: string[]
    inputs: Record<string, unknown>
  }) {
    const { data } = await api.post('/api/admin/documents/attendance-log/generate', payload)
    return data
  },

  async generateCertificates(payload: {
    courseId: string
    variant: string
    studentIds: string[]
    inputs: Record<string, unknown>
    withSign?: boolean
  }) {
    const { data } = await api.post('/api/admin/documents/certificate/generate', payload)
    return data
  },

  async manage(docType: string, params?: { courseId?: string; q?: string }) {
    const { data } = await api.get<{ items: DocumentItem[] }>(`/api/admin/documents/${docType}/manage`, { params })
    return data.items
  },

  async download(docId: string, item?: DocumentItem): Promise<Blob> {
    const certNo = item?.letterNo || item?.certificateId
    if (item && isCertificateDocument(item) && certNo) {
      return certificateService.pdfBlobForCertNo(certNo)
    }
    const { data } = await api.get(`/api/admin/documents/${docId}/download`, {
      params: { _t: Date.now() },
      responseType: 'arraybuffer',
      headers: { Accept: 'application/pdf, application/octet-stream' },
    })
    return pdfBlobFromArrayBuffer(data as ArrayBuffer)
  },

  async bulkDownload(docIds: string[], withSign = true): Promise<Blob> {
    const { data } = await api.post(
      '/api/admin/documents/bulk-download',
      { docIds, withSign },
      { responseType: 'arraybuffer', headers: { Accept: 'application/zip' } },
    )
    return new Blob([data], { type: 'application/zip' })
  },

  async delete(docId: string) {
    const { data } = await api.delete(`/api/admin/documents/${docId}`)
    return data
  },

  async listMy() {
    const { data } = await api.get<{ items: DocumentItem[] }>('/api/student/documents')
    return data.items
  },

  async downloadMy(docId: string, item?: DocumentItem): Promise<Blob> {
    const certNo = item?.letterNo || item?.certificateId
    if (item && isCertificateDocument(item) && certNo) {
      return certificateService.pdfBlobForCertNo(certNo)
    }
    const { data } = await api.get(`/api/student/documents/${docId}/download`, {
      responseType: 'arraybuffer',
      headers: { Accept: 'application/pdf, application/octet-stream' },
    })
    return pdfBlobFromArrayBuffer(data as ArrayBuffer)
  },
}
