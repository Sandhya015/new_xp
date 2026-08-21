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

export type CrmLead = {
  id: string
  fullName: string
  mobile: string | null
  email: string | null
  score: number
  temperature: 'hot' | 'warm' | 'cold'
  lifecycleStage: string
  status: string
  assignedTo: string | null
  assignedToName: string | null
  assignedAt: string | null
  lastEventAt: string | null
  lastEventType: string | null
  lastSource: string | null
  followUpAt: string | null
  disposition: string | null
  callAttempts: number
  lastCourseId?: string | null
  lastCourseTitle?: string | null
  sourcesSeen: string[]
  createdAt: string | null
  updatedAt: string | null
}

export type CrmEvent = {
  id: string
  leadId: string
  eventType: string
  source: string
  payload: Record<string, unknown>
  scoreDelta?: number
  createdAt: string | null
}

export type CrmLeadDetail = {
  lead: CrmLead
  events: CrmEvent[]
  notes: Array<{ id: string; body: string; authorName?: string; createdAt: string | null }>
  calls: Array<{ id: string; direction: string; status: string; durationSec?: number; recordingUrl?: string; agentName?: string; createdAt: string | null }>
}

export type CrmAgent = {
  id: string
  email: string
  fullName: string
  leadRole: string
  mobile?: string | null
  telecmiAgentId?: string | null
  accountStatus?: string
}

export type CrmSummary = {
  totalOpen: number
  unassigned: number
  hot: number
  followUpsDue: number
  newToday: number
  enrolled: number
  viewCounts?: Record<string, number>
}

export type CrmListParams = {
  view?: string
  assignedTo?: string
  lifecycle?: string
  temperature?: string
  q?: string
  followUpDue?: boolean
  page?: number
  limit?: number
}

export type CrmListResponse = {
  items: CrmLead[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const CRM_VIEWS = [
  { id: '', label: 'All Leads', countKey: null as string | null },
  { id: 'contact_us', label: 'Contact & Callback', countKey: 'contact_us' },
  { id: 'training_interest', label: 'Training Interest', countKey: 'training_interest' },
  { id: 'registration', label: 'Registration', countKey: 'registration' },
  { id: 'payment_recovery', label: 'Payment Recovery', countKey: 'payment_recovery' },
  { id: 'campaigns', label: 'Campaign | QR', countKey: 'campaigns' },
  { id: 'uploads', label: 'Uploaded', countKey: 'uploads' },
  { id: 'converted', label: 'Converted', countKey: 'converted' },
] as const

export const LIFECYCLE_OPTIONS = [
  { value: '', label: 'All stages' },
  { value: 'new', label: 'New' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'interested', label: 'Interested' },
  { value: 'follow_up_scheduled', label: 'Follow-up scheduled' },
  { value: 'payment_pending', label: 'Payment pending' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'dnd', label: 'DND' },
]

export const crmService = {
  async getSummary(): Promise<CrmSummary> {
    const { data } = await api.get<CrmSummary>('/api/crm/summary')
    return data
  },

  async listLeads(params?: CrmListParams): Promise<CrmListResponse> {
    const { data } = await api.get<CrmListResponse>('/api/crm/leads', {
      params: {
        ...params,
        followUpDue: params?.followUpDue ? '1' : undefined,
      },
    })
    return data
  },

  async getLead(id: string): Promise<CrmLeadDetail> {
    const { data } = await api.get<CrmLeadDetail>(`/api/crm/leads/${id}`)
    return data
  },

  async assignLead(leadId: string, agentId: string) {
    const { data } = await api.post(`/api/crm/leads/${leadId}/assign`, { agentId })
    return data
  },

  async bulkAssign(leadIds: string[], agentId: string) {
    const { data } = await api.post('/api/crm/leads/bulk-assign', { leadIds, agentId })
    return data
  },

  async roundRobinAssign(leadIds: string[], agentIds?: string[]) {
    const { data } = await api.post('/api/crm/leads/round-robin-assign', { leadIds, agentIds })
    return data
  },

  async setDisposition(leadId: string, body: { disposition: string; note?: string; followUpAt?: string }) {
    const { data } = await api.post(`/api/crm/leads/${leadId}/disposition`, body)
    return data
  },

  async addNote(leadId: string, body: string) {
    const { data } = await api.post(`/api/crm/leads/${leadId}/notes`, { body })
    return data
  },

  async initiateCall(leadId: string) {
    const { data } = await api.post(`/api/crm/leads/${leadId}/call`)
    return data
  },

  async getMyDay() {
    const { data } = await api.get<{
      followUps: CrmLead[]
      newAssigned: CrmLead[]
      hotUncontacted: CrmLead[]
    }>('/api/crm/my-day')
    return data
  },

  async listAgents(): Promise<CrmAgent[]> {
    const { data } = await api.get<{ items: CrmAgent[] }>('/api/crm/agents')
    return data.items
  },

  async createAgent(body: {
    fullName: string
    email: string
    mobile?: string
    telecmiAgentId?: string
    telecmiExtension?: string
    leadRole?: string
    password?: string
    reportingManagerId?: string
    dailyLeadCapacity?: number
  }) {
    const { data } = await api.post<{
      ok: boolean
      agent: CrmAgent
      temporaryPassword?: string
      emailSent?: boolean
    }>('/api/crm/agents', body)
    return data
  },

  async listTelecmiAgents(): Promise<Array<{ agentId: string; name: string; mobile?: string }>> {
    const { data } = await api.get<{ items: Array<{ agentId: string; name: string; mobile?: string }> }>(
      '/api/crm/telecmi/agents',
    )
    return data.items
  },

  async listDispositions(): Promise<string[]> {
    const { data } = await api.get<{ items: string[] }>('/api/crm/dispositions')
    return data.items
  },

  async exportLeads(params?: CrmListParams): Promise<Blob> {
    const { data } = await api.get<Blob>('/api/crm/leads/export', {
      params: {
        ...params,
        followUpDue: params?.followUpDue ? '1' : undefined,
      },
      responseType: 'blob',
    })
    return data
  },

  async migrateContacts(limit = 500) {
    const { data } = await api.post('/api/crm/migrate-contacts', { limit })
    return data
  },

  async createLead(body: {
    fullName: string
    mobile: string
    source?: string
    courseId?: string
    courseTitle?: string
  }) {
    const { data } = await api.post<{ ok: boolean; leadId?: string; error?: string }>('/api/crm/leads', body)
    return data
  },

  async getCallLog(limit = 50): Promise<{
    stats: { totalCalls: number; connected: number; avgDurationSec: number; followUpsSet: number }
    items: Array<{
      id: string
      leadId: string | null
      leadName: string
      leadMobile: string | null
      agentName: string
      status: string
      durationSec?: number
      recordingUrl?: string
      createdAt: string | null
    }>
  }> {
    const { data } = await api.get('/api/crm/calls', { params: { limit } })
    return data
  },

  async getOverviewExtras(): Promise<{
    agentWorkload: Array<CrmAgent & { activeLeads: number; callsToday: number; capacityPct: number }>
    recentActivity: Array<{
      id: string
      eventType: string
      source: string
      leadId: string | null
      leadName: string
      createdAt: string | null
      payload: Record<string, unknown>
    }>
  }> {
    const { data } = await api.get('/api/crm/overview-extras')
    return data
  },

  async getSettings(): Promise<CrmSettings> {
    const { data } = await api.get<CrmSettings>('/api/crm/settings')
    return data
  },

  async updateSettings(patch: Partial<CrmSettings>): Promise<{ ok: boolean; settings: CrmSettings }> {
    const { data } = await api.patch('/api/crm/settings', patch)
    return data
  },

  async getAuditLog(limit = 30): Promise<CrmAuditEntry[]> {
    const { data } = await api.get<{ items: CrmAuditEntry[] }>('/api/crm/audit-log', { params: { limit } })
    return data.items
  },

  async getFollowUps(): Promise<{ items: CrmLead[]; stats: CrmFollowUpStats }> {
    const { data } = await api.get<{ items: CrmLead[]; stats: CrmFollowUpStats }>('/api/crm/follow-ups')
    return data
  },

  async scheduleFollowUp(leadId: string, body: { followUpAt: string; note: string }) {
    const { data } = await api.post(`/api/crm/leads/${leadId}/follow-up`, body)
    return data
  },

  async rescheduleFollowUp(leadId: string, body: { followUpAt: string; note?: string }) {
    const { data } = await api.patch(`/api/crm/leads/${leadId}/follow-up`, body)
    return data
  },

  async completeFollowUp(leadId: string, note?: string) {
    const { data } = await api.post(`/api/crm/leads/${leadId}/follow-up/complete`, { note })
    return data
  },

  async importLeads(file: File, opts?: { duplicateMode?: string; assignMode?: string }) {
    const form = new FormData()
    form.append('file', file)
    if (opts?.duplicateMode) form.append('duplicateMode', opts.duplicateMode)
    if (opts?.assignMode) form.append('assignMode', opts.assignMode)
    const { data } = await api.post('/api/crm/imports', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data as {
      ok: boolean
      added: number
      updated: number
      errors: string[]
      status: string
    }
  },

  async listImports(limit = 20): Promise<CrmImportRecord[]> {
    const { data } = await api.get<{ items: CrmImportRecord[] }>('/api/crm/imports', { params: { limit } })
    return data.items
  },

  async downloadImportTemplate(): Promise<Blob> {
    const { data } = await api.get<Blob>('/api/crm/imports/template', { responseType: 'blob' })
    return data
  },

  async testTelecmi(): Promise<{ ok: boolean; status: Record<string, unknown> }> {
    const { data } = await api.post('/api/crm/telecmi/test')
    return data
  },
}

export type CrmSettings = {
  autoAssign: boolean
  duplicateDetection: boolean
  overdueFollowUpAlerts: boolean
  recordingAccess: boolean
  emailAlerts: boolean
  whatsappAlerts: boolean
  recordingRetentionDays: number
}

export type CrmAuditEntry = {
  id: string
  action: string
  actorName: string
  meta: Record<string, unknown>
  ip?: string | null
  createdAt: string | null
}

export type CrmFollowUpStats = {
  open: number
  overdue: number
  dueToday: number
  upcoming: number
  completedOnTimePct: number
}

export type CrmImportRecord = {
  id: string
  filename: string
  type: string
  added: number
  updated: number
  errorCount: number
  status: string
  meta: string
  createdAt: string | null
}
