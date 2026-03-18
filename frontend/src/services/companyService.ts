import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({ baseURL: getApiBase(), withCredentials: true })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface CompanyDashboardData {
  companyName: string
  accountStatus: string
  profileComplete: number
  stats: {
    totalListings: number
    activeListings: number
    draftListings: number
    pausedListings: number
    closedListings: number
    totalApplicants: number
    shortlisted: number
    selected: number
    notSelected: number
  }
  recentActivity: Array<{
    type: string
    text: string
    applicationId?: string
    internshipId?: string
    createdAt: string
  }>
}

export const companyService = {
  async getDashboard(): Promise<CompanyDashboardData> {
    const { data } = await api.get<CompanyDashboardData>('/api/company/dashboard')
    return data
  },
}
