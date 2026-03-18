import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

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

  async createCourse(payload: Record<string, unknown>) {
    const { data } = await api.post('/api/admin/courses', payload)
    return data
  },

  async getCourseEnrollments(courseId: string) {
    const { data } = await api.get<{ items: Array<{
      id: string
      userId: string
      name: string
      email: string
      mobile: string
      university: string
      collegeName: string
      course: string
      stream: string
      semester: string
      enrolledAt: string
      batch: string
      orderId: string
    }> }>(`/api/admin/courses/${courseId}/enrollments`)
    return data
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

  async getCertificates(params?: { search?: string; status?: string }) {
    const { data } = await api.get<{ items: Array<{ id: string; certNo: string; studentName: string; programName: string; issueDate: string; university: string; status: string }> }>('/api/admin/certificates', { params })
    return data
  },

  async getCertificateTrainings() {
    const { data } = await api.get<{ items: Array<{ id: string; title: string }> }>('/api/admin/certificates/trainings')
    return data
  },
}
