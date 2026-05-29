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

/**
 * API Gateway (REST + Lambda proxy) uses the **first** `Accept` request header value against
 * `binaryMediaTypes` to decide whether to decode `isBase64Encoded` bodies. Axios defaults to
 * `Accept: application/json, ...` first, so binary responses stay as base64 text unless we send
 * an Accept that matches a configured binary type (see backend serverless.yml).
 */
function blobFromMaybeBase64Body(
  buffer: ArrayBuffer,
  mime: string,
  kind: 'zip' | 'pdf',
): Blob {
  const u8 = new Uint8Array(buffer)
  const magicOk =
    kind === 'zip'
      ? u8.length >= 2 && u8[0] === 0x50 && u8[1] === 0x4b
      : u8.length >= 4 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46
  if (magicOk) return new Blob([buffer], { type: mime })
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer).trim()
  if (text.startsWith('{')) return new Blob([buffer], { type: mime })
  const cleaned = text.replace(/\s/g, '')
  if (
    cleaned.length < 8 ||
    !/^[A-Za-z0-9+/=]+$/.test(cleaned.slice(0, Math.min(1000, cleaned.length)))
  ) {
    return new Blob([buffer], { type: mime })
  }
  try {
    const bin = atob(cleaned)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    const ok2 =
      kind === 'zip'
        ? out.length >= 2 && out[0] === 0x50 && out[1] === 0x4b
        : out.length >= 4 && out[0] === 0x25 && out[1] === 0x50 && out[2] === 0x44 && out[3] === 0x46
    if (ok2) return new Blob([out], { type: mime })
  } catch {
    /* ignore */
  }
  return new Blob([buffer], { type: mime })
}

export type AdminCertificateFormPayload = {
  certNo: string
  studentName: string
  collegeName: string
  course: string
  branch: string
  semester: string
  registrationNo: string
  domain: string
  mode: string
  internshipStartDate: string
  internshipEndDate: string
  marks: string
  attendance: string
  session: string
  duration: string
  performanceRating: string
  autoGenerateCertNo?: boolean
}

export type DashboardData = {
  kpis: {
    totalStudents: number
    totalTrainings: number
    totalCompanies: number
    totalInternships: number
    totalRevenue: number
    revenueThisMonth: number
    certificatesGenerated: number
    newLeads7Days: number
    pendingApprovals: number
    activeEnrollments: number
  }
  pendingItems: Array<{ label: string; count: number; to: string }>
  recentActivity: Array<{ type: string; text: string; time: string; entityId: string }>
}

export type LeadDetail = {
  id: string
  name: string
  mobile: string
  email: string
  university: string
  course: string
  queryType: string
  submitted: string
  status: string
  assignedTo: string
  followUps?: Array<{ type: string; date: string; notes: string; addedBy: string; createdAt: string }>
}

export type StudentDetail = {
  id: string
  name: string
  email: string
  mobile: string
  university: string
  course: string
  registered: string
  status: string
  collegeName?: string
  stream?: string
  semester?: string
  enrollments?: Array<{ id: string; courseId: string; courseTitle: string; createdAt: string }>
  applications?: Array<{ id: string; internshipId: string; status: string; createdAt: string }>
}

export type PaymentDetail = {
  id: string
  orderId: string
  studentId: string
  amount: number
  status: string
  createdAt: string
  courseId?: string
  gatewayRef?: string
}

export type CompanyRow = {
  id: string
  name: string
  industry: string
  contactEmail: string
  registered: string
  listings: number
  applicants: number
  status: string
  verified: boolean
}

export type InternshipRow = {
  id: string
  title: string
  companyName: string
  companyId: string
  category: string
  type: string
  posted: string
  deadline: string
  applicants: number
  status: string
  active: boolean
  featured: boolean
}

export const adminService = {
  async getDashboard(): Promise<DashboardData> {
    const { data } = await api.get<DashboardData>('/api/admin/dashboard')
    return data
  },

  async getStudents(params?: { search?: string }) {
    const { data } = await api.get<{ items: Array<{ id: string; name: string; email: string; mobile: string; university: string; course: string; registered: string; status: string }> }>('/api/admin/students', { params })
    return data
  },

  async getStudent(id: string): Promise<StudentDetail> {
    const { data } = await api.get<StudentDetail>(`/api/admin/students/${id}`)
    return data
  },

  async getLeads(params?: { search?: string; status?: string }) {
    const { data } = await api.get<{ items: LeadDetail[] }>('/api/admin/leads', { params })
    return data
  },

  async getLead(id: string): Promise<LeadDetail> {
    const { data } = await api.get<LeadDetail>(`/api/admin/leads/${id}`)
    return data
  },

  async updateLead(id: string, body: { status?: string; assignedTo?: string; followUp?: { type: string; date?: string; notes: string } }) {
    const { data } = await api.patch<LeadDetail>(`/api/admin/leads/${id}`, body)
    return data
  },

  async getPayments(params?: { search?: string; status?: string }) {
    const { data } = await api.get<{ items: PaymentDetail[] }>('/api/admin/payments', { params })
    return data
  },

  async getPayment(id: string): Promise<PaymentDetail> {
    const { data } = await api.get<PaymentDetail>(`/api/admin/payments/${id}`)
    return data
  },

  async verifyPayment(id: string, body: { reference?: string; note?: string }) {
    const { data } = await api.post<{ ok: boolean }>(`/api/admin/payments/${id}/verify`, body)
    return data
  },

  async refundPayment(id: string, body: { reason: string; amount?: number; gatewayRef?: string }) {
    const { data } = await api.post<{ ok: boolean }>(`/api/admin/payments/${id}/refund`, body)
    return data
  },

  async getCourses(params?: { search?: string }) {
    const { data } = await api.get<{ items: unknown[] }>('/api/admin/courses', { params })
    return data
  },

  async getCourse(id: string) {
    const { data } = await api.get(`/api/admin/courses/${id}`)
    return data
  },

  async updateCourse(id: string, payload: Record<string, unknown>) {
    const { data } = await api.patch(`/api/admin/courses/${id}`, payload)
    return data
  },

  /** Replace curriculum only; server normalizes to the Add Training / Tutor topic shape. */
  async updateCourseCurriculum(courseId: string, curriculum: unknown[]) {
    const { data } = await api.put<{ ok: boolean; curriculum: unknown[] }>(
      `/api/admin/courses/${courseId}/curriculum`,
      { curriculum }
    )
    return data
  },

  async getCourseCouponRedemptions(courseId: string) {
    const { data } = await api.get<{
      items: Array<{ code: string; used: number; maxUses: number | null }>
    }>(`/api/admin/courses/${courseId}/coupon-redemptions`)
    return data
  },

  async getCourseCurriculumQuizAttempts(courseId: string) {
    const { data } = await api.get<{
      items: Array<{
        enrollmentId: string
        userId: string
        studentName: string
        email: string
        attempts: Array<{
          quizTitle: string
          passed: boolean
          scorePercent?: number
          attempts?: number
          attemptsMax?: number
          updatedAt?: string
        }>
      }>
    }>(`/api/admin/courses/${courseId}/curriculum-quiz-attempts`)
    return data
  },

  async createCourse(payload: Record<string, unknown>) {
    const { data } = await api.post('/api/admin/courses', payload)
    return data
  },

  /**
   * Featured (≤2MB), intro/lesson video (MP4/MOV/AVI), or study material (PDF/PPT/DOC/XLS/ZIP/TXT/CSV; max MB from server).
   */
  /**
   * Returns API-relative path only (e.g. `/api/courses/media/featured/...`).
   * Persist this in Mongo; use `absoluteApiUrl()` at display time so production never stores localhost.
   */
  async uploadCourseMedia(file: File, kind: 'featured' | 'intro' | 'lesson' | 'material'): Promise<string> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    const { data } = await api.post<{ url: string }>('/api/admin/uploads/course-media', fd)
    const path = (data.url || '').trim()
    if (path.startsWith('/')) return path
    if (path.startsWith('http://') || path.startsWith('https://')) {
      try {
        const u = new URL(path)
        return `${u.pathname}${u.search}${u.hash}` || path
      } catch {
        return path
      }
    }
    return path.startsWith('/') ? path : `/${path.replace(/^\/+/, '')}`
  },

  /**
   * True if this API already has the file for a stored /api/courses/media/... path (HEAD).
   * Used before save when no new file was chosen, so we do not persist a cover that exists only on another API (e.g. local Flask).
   */
  async verifyHostedCourseMediaExists(relativePath: string): Promise<boolean> {
    const p = (relativePath || '').trim()
    if (!p.startsWith('/api/courses/media/')) return true
    try {
      await api.head(p)
      return true
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 404) return false
      throw e
    }
  },

  async getCourseReviews(courseId: string) {
    const { data } = await api.get<{
      items: Array<{
        id: string
        studentName: string
        userId: string
        rating: number
        title: string
        body: string
        flagged: boolean
        deleted: boolean
        createdAt: string
      }>
    }>(`/api/admin/courses/${courseId}/reviews`)
    return data
  },

  async deleteCourseReview(courseId: string, reviewId: string) {
    await api.delete(`/api/admin/courses/${courseId}/reviews/${reviewId}`)
  },

  async flagCourseReview(courseId: string, reviewId: string, flagged: boolean) {
    await api.patch(`/api/admin/courses/${courseId}/reviews/${reviewId}/flag`, { flagged })
  },

  async getCourseEnrollments(courseId: string, query?: Record<string, string>) {
    const params =
      query && Object.keys(query).length
        ? Object.fromEntries(Object.entries(query).filter(([, v]) => String(v ?? '').trim() !== ''))
        : undefined
    const { data } = await api.get<{
      items: Array<{
        id: string
        userId: string
        name: string
        email: string
        mobile: string
        university: string
        collegeName: string
        course: string
        stream: string
        branch?: string
        semester: string
        registrationNumber?: string
        enrolledAt: string
        submissionsCount?: number
        batch: string
        orderId: string
        assignmentSubmissions?: Array<{
          assignmentId: string
          assignmentTitle?: string
          text?: string
          fileUrl?: string
          originalFileName?: string
          mimeType?: string
          fileStorageName?: string
          submittedAt?: string
        }>
      }>
    }>(`/api/admin/courses/${courseId}/enrollments`, { params })
    return data
  },

  /** Excel: enrollments, assignment submission columns, completion quiz flags, ApproveCertificate (for re-upload). */
  async downloadEnrollmentsCertificateSheet(courseId: string, query?: Record<string, string>): Promise<Blob> {
    const params =
      query && Object.keys(query).length
        ? Object.fromEntries(Object.entries(query).filter(([, v]) => String(v ?? '').trim() !== ''))
        : undefined
    const { data } = await api.get(`/api/admin/courses/${courseId}/enrollments/export.xlsx`, {
      params,
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })
    return blobFromMaybeBase64Body(
      data as ArrayBuffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'zip',
    )
  },

  async parseCertificateSheet(
    courseId: string,
    file: File,
  ): Promise<{
    items: Array<{
      enrollmentId: string
      email: string
      name: string
      matched: boolean
      approveInSheet: boolean
      completionQuizPassed: boolean
      certificateIssued: boolean
    }>
    count: number
  }> {
    // JSON + base64 avoids API Gateway treating multipart/form-data as binary and corrupting .xlsx bytes
    // (openpyxl then fails with "File is not a zip file" even for valid workbooks).
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    const chunkSize = 0x8000
    let binary = ''
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
      binary += String.fromCharCode.apply(null, sub as unknown as number[])
    }
    const fileBase64 = btoa(binary)
    const { data } = await api.post(
      `/api/admin/courses/${courseId}/enrollments/certificate-sheet/parse`,
      { fileBase64, filename: file.name || 'upload.xlsx' },
      { headers: { 'Content-Type': 'application/json' } },
    )
    return data
  },

  async bulkEmailCertificates(
    courseId: string,
    enrollmentIds: string[],
  ): Promise<{
    ok: boolean
    issuedOrEmailed: number
    newlyIssued?: number
    resent?: number
    skippedAlreadyIssued: number
    errors: Array<{ enrollmentId: string; error: string }>
  }> {
    const { data } = await api.post(`/api/admin/courses/${courseId}/certificates/bulk-email`, { enrollmentIds })
    return data
  },

  /** Authenticated download (admin JWT). Student app uses the same path with student JWT. */
  async downloadAssignmentSubmissionFile(fileStorageName: string): Promise<Blob> {
    const { data, headers } = await api.get(
      `/api/enrollments/submission-media/${encodeURIComponent(fileStorageName)}`,
      {
        responseType: 'arraybuffer',
        headers: {
          // Must be first in Accept and match API GW binaryMediaTypes so Lambda base64 is decoded.
          Accept: 'application/octet-stream, image/jpeg, image/png, application/pdf',
        },
      },
    )
    const ct =
      (typeof headers['content-type'] === 'string' && headers['content-type']) ||
      'application/octet-stream'
    return new Blob([data as ArrayBuffer], { type: ct.split(';')[0].trim() })
  },

  async getCompanies(params?: { status?: string }) {
    const { data } = await api.get<{ items: CompanyRow[] }>('/api/admin/companies', { params })
    return data
  },

  async getCompany(id: string) {
    const { data } = await api.get<CompanyRow & { hrName?: string; hrMobile?: string; address?: string; website?: string }>(`/api/admin/companies/${id}`)
    return data
  },

  async approveCompany(id: string) {
    const { data } = await api.post<{ ok: boolean }>(`/api/admin/companies/${id}/approve`)
    return data
  },

  async rejectCompany(id: string, reason: string) {
    const { data } = await api.post<{ ok: boolean }>(`/api/admin/companies/${id}/reject`, { reason })
    return data
  },

  async requestCompanyInfo(id: string, message: string) {
    const { data } = await api.post<{ ok: boolean }>(`/api/admin/companies/${id}/request-info`, { message })
    return data
  },

  async getInternships(params?: { status?: string }) {
    const { data } = await api.get<{ items: InternshipRow[] }>('/api/admin/internships', { params })
    return data
  },

  async getInternship(id: string) {
    const { data } = await api.get<InternshipRow & { description?: string; requirements?: string; skills?: string; stipend?: string; location?: string; openings?: number }>(`/api/admin/internships/${id}`)
    return data
  },

  async approveInternship(id: string) {
    const { data } = await api.post<{ ok: boolean }>(`/api/admin/internships/${id}/approve`)
    return data
  },

  async rejectInternship(id: string, reason: string) {
    const { data } = await api.post<{ ok: boolean }>(`/api/admin/internships/${id}/reject`, { reason })
    return data
  },

  async featureInternship(id: string) {
    const { data } = await api.post<{ ok: boolean }>(`/api/admin/internships/${id}/feature`)
    return data
  },

  async forceCloseInternship(id: string) {
    const { data } = await api.post<{ ok: boolean }>(`/api/admin/internships/${id}/force-close`)
    return data
  },

  async getCertificates(params?: { search?: string; status?: string; email?: string }) {
    const { data } = await api.get<{
      items: Array<{
        id: string
        certNo: string
        studentName: string
        studentEmail: string
        programName: string
        courseId: string
        issueDate: string
        completionDate: string
        university: string
        collegeName?: string
        domain?: string
        mode?: string
        status: string
        source: string
        hasUploadedPdf?: boolean
      }>
    }>('/api/admin/certificates', { params })
    return data
  },

  async getCertificateDetail(id: string) {
    const { data } = await api.get<{
      id: string
      certNo: string
      studentName: string
      studentEmail: string
      studentMobile: string
      studentId: string
      programName: string
      courseId: string
      courseTitle: string
      university: string
      collegeName?: string
      course?: string
      branch?: string
      semester?: string
      registrationNo?: string
      domain?: string
      mode?: string
      internshipStartDate?: string
      internshipEndDate?: string
      marks?: string
      attendance?: string
      session?: string
      duration?: string
      performanceRating?: string
      issueDate: string
      completionDate: string
      status: string
      source: string
      revokeReason: string
      revokedAt: string
      hasUploadedPdf?: boolean
      verifyUrl?: string
    }>(`/api/admin/certificates/${id}`)
    return data
  },

  async createCertificate(payload: AdminCertificateFormPayload) {
    const { data } = await api.post<{ id: string; certNo: string; message?: string }>('/api/admin/certificates', payload)
    return data
  },

  async updateCertificate(id: string, payload: AdminCertificateFormPayload) {
    const { data } = await api.put(`/api/admin/certificates/${id}`, payload)
    return data
  },

  async deleteCertificate(id: string) {
    const { data } = await api.delete<{ ok: boolean; message?: string }>(`/api/admin/certificates/${id}`)
    return data
  },

  async uploadCertificatePdf(id: string, file: File) {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post<{ ok: boolean; message?: string }>(`/api/admin/certificates/${id}/upload-pdf`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  async getCertificateAuditLog(id: string) {
    const { data } = await api.get<{ items: Array<{ action: string; adminEmail: string; createdAt: string }> }>(
      `/api/admin/certificates/${id}/audit`,
    )
    return data
  },

  async downloadAdminCertificatePdf(id: string): Promise<Blob> {
    const { data } = await api.get(`/api/admin/certificates/${id}/pdf`, {
      responseType: 'arraybuffer',
      headers: { Accept: 'application/pdf' },
    })
    return blobFromMaybeBase64Body(data as ArrayBuffer, 'application/pdf', 'pdf')
  },

  async revokeCertificate(id: string, reason: string) {
    const { data } = await api.post<{ ok: boolean; message?: string }>(`/api/admin/certificates/${id}/revoke`, { reason })
    return data
  },

  async getCertificateTrainings() {
    const { data } = await api.get<{ items: Array<{ id: string; title: string }> }>('/api/admin/certificates/trainings')
    return data
  },

  async listSupportTickets(params?: {
    status?: string
    category?: string
    priority?: string
    dateFrom?: string
    dateTo?: string
  }) {
    const { data } = await api.get<{
      items: Array<{
        id: string
        ticketId: string
        studentName: string
        studentEmail: string
        subject: string
        category: string
        status: string
        priority: string
        createdAt: string
        updatedAt?: string
        messages?: Array<{ from: string; body: string; createdAt: string }>
      }>
    }>('/api/admin/support-tickets', { params })
    return data
  },

  async getSupportTicket(id: string) {
    const { data } = await api.get<{
      id: string
      ticketId: string
      studentName: string
      studentEmail: string
      subject: string
      category: string
      description: string
      status: string
      priority: string
      createdAt: string
      updatedAt?: string
      messages?: Array<{ from: string; body: string; createdAt: string }>
    }>(`/api/admin/support-tickets/${id}`)
    return data
  },

  async replySupportTicket(id: string, message: string) {
    const { data } = await api.post(`/api/admin/support-tickets/${id}/reply`, { message })
    return data
  },

  async setSupportTicketStatus(id: string, status: string) {
    const { data } = await api.patch(`/api/admin/support-tickets/${id}/status`, { status })
    return data
  },

  async getCourseAttendance(courseId: string) {
    const { data } = await api.get<{
      sessions: Array<{
        sessionKey: string
        title: string
        sessionDate: string
        time: string
        platform: string
        canMark: boolean
        records: Record<string, { status: string; note: string }>
        updatedAt: string
      }>
      students: Array<{ userId: string; name: string; email: string }>
    }>(`/api/admin/courses/${courseId}/attendance`)
    return data
  },

  async putCourseAttendanceSession(
    courseId: string,
    sessionKey: string,
    body: { markAllPresent?: boolean; records?: Array<{ userId: string; status: string; note?: string }> },
  ) {
    const { data } = await api.put<{ ok: boolean; count?: number }>(
      `/api/admin/courses/${courseId}/attendance/${encodeURIComponent(sessionKey)}`,
      body,
    )
    return data
  },

  async getSupportContentAdmin() {
    const { data } = await api.get<{
      faqs: Array<{ id: string; question: string; answer: string; sortOrder: number }>
    }>('/api/admin/support-content')
    return data
  },

  async putSupportContentAdmin(faqs: Array<{ id: string; question: string; answer: string; sortOrder: number }>) {
    const { data } = await api.put<{ ok: boolean; faqs: typeof faqs }>('/api/admin/support-content', { faqs })
    return data
  },
}
