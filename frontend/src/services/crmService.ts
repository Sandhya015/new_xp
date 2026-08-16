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
  { id: '', label: 'All Leads', countKey: null },
  { id: 'contact_us', label: 'Contact Us', countKey: 'contact_us' },
  { id: 'callback', label: 'Callbacks', countKey: 'callback' },
  { id: 'training_interest', label: 'Training Interest', countKey: 'training_interest' },
  { id: 'registration', label: 'Registration', countKey: 'registration' },
  { id: 'payment_recovery', label: 'Payment Recovery', countKey: 'payment_recovery' },
  { id: 'converted', label: 'Converted', countKey: 'converted' },
  { id: 'inbound', label: 'Inbound Calls', countKey: 'inbound' },
  { id: 'campaigns', label: 'Campaigns', countKey: 'campaigns' },
  { id: 'uploads', label: 'Uploads', countKey: 'uploads' },
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
    leadRole?: string
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
}
