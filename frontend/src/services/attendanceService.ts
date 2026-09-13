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

export type AttendanceConfig = {
  id?: string
  courseId: string
  session?: string
  semester?: string
  durationUnit: 'hours' | 'weeks'
  totalHours: number
  dailyHours: number
  durationWeeks: number
  universityDateRanges: Array<{ university: string; validFrom: string; validTo: string }>
  updatedAt?: string | null
}

export type AttendanceStudentRow = {
  userId: string
  enrollmentId: string
  name: string
  email: string
  university: string
  collegeName: string
  batch: string
  attendancePercent: number | null
}

export const attendanceService = {
  async getConfig(courseId: string) {
    const { data } = await api.get<{ config: AttendanceConfig | null }>(`/api/admin/attendance-mgmt/config/${courseId}`)
    return data.config
  },

  async saveConfig(courseId: string, payload: Partial<AttendanceConfig>) {
    const { data } = await api.put<{ config: AttendanceConfig }>(`/api/admin/attendance-mgmt/config/${courseId}`, payload)
    return data.config
  },

  async listStudents(courseId: string) {
    const { data } = await api.get<{ students: AttendanceStudentRow[]; config: AttendanceConfig | null }>(
      `/api/admin/attendance-mgmt/${courseId}/students`,
    )
    return data
  },

  async studentHistory(courseId: string, userId: string) {
    const { data } = await api.get<{ history: Array<Record<string, unknown>>; percent: number | null }>(
      `/api/admin/attendance-mgmt/${courseId}/students/${userId}/history`,
    )
    return data
  },

  async bulkMark(payload: {
    courseId: string
    userIds: string[]
    dateFrom: string
    dateTo: string
    status: string
  }) {
    const { data } = await api.post('/api/admin/attendance-mgmt/mark', payload)
    return data
  },

  async getDailyHistory(courseId: string) {
    const { data } = await api.get<{
      config: AttendanceConfig | null
      percent: number | null
      completedHours: number
      requiredHours: number
      today: { date: string; timeIn?: string | null; timeOut?: string | null; status?: string | null }
      history: Array<Record<string, unknown>>
    }>(`/api/enrollments/by-course/${courseId}/attendance/history`)
    return data
  },

  async markIn(courseId: string, photo: Blob, meta?: { latitude?: number; longitude?: number; locationLabel?: string }) {
    const form = new FormData()
    form.append('photo', photo, 'attendance.jpg')
    if (meta?.latitude != null) form.append('latitude', String(meta.latitude))
    if (meta?.longitude != null) form.append('longitude', String(meta.longitude))
    if (meta?.locationLabel) form.append('locationLabel', meta.locationLabel)
    const { data } = await api.post(`/api/enrollments/by-course/${courseId}/attendance/mark-in`, form)
    return data
  },

  async markOut(courseId: string) {
    const { data } = await api.post(`/api/enrollments/by-course/${courseId}/attendance/mark-out`)
    return data
  },
}
