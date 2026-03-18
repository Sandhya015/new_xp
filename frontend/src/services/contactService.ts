import axios from 'axios'
import { getApiBase } from '@/config/api'

const api = axios.create({ baseURL: getApiBase(), headers: { 'Content-Type': 'application/json' } })

export type ContactPayload = {
  name: string
  email: string
  phone?: string
  message?: string
  queryFor?: string
  university?: string
  semester?: string
  course?: string
  stream?: string
}

export const contactService = {
  async submit(payload: ContactPayload) {
    const { data } = await api.post<{ message: string }>('/api/contact', payload)
    return data
  },
}
