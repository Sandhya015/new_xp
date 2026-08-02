import axios from 'axios'
import { getApiBase } from '@/config/api'

export type SupportFaqItem = {
  id: string
  question: string
  answer: string
  sortOrder: number
  displayOrder?: number
  category?: string
  visibility?: string
  active?: boolean
}

export type SupportContactPayload = {
  email: string
  phone: string
  phoneTel: string
  hours: string
  address: string
  whatsappUrl: string
  social: {
    facebook: string
    instagram: string
    linkedin: string
    x: string
    youtube: string
  }
}

export async function fetchSupportContent(
  audience: 'public' | 'students' = 'students',
): Promise<{ faqs: SupportFaqItem[]; contact: SupportContactPayload }> {
  const base = getApiBase().replace(/\/$/, '')
  const { data } = await axios.get<{ faqs: SupportFaqItem[]; contact: SupportContactPayload }>(
    `${base}/api/settings/support-content`,
    { params: { audience }, withCredentials: false },
  )
  return data
}
