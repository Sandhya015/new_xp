import axios from 'axios'
import { getApiBase } from '@/config/api'

export type TrainingCheckoutSettings = {
  trainingKitPriceInr: number
  gstPercent: number
  coupons: Array<{ code: string; label?: string; percentOff?: number; rupeesOff?: number }>
}

export async function fetchTrainingCheckoutSettings(): Promise<TrainingCheckoutSettings> {
  const base = getApiBase().replace(/\/$/, '')
  const { data } = await axios.get<TrainingCheckoutSettings>(`${base}/api/settings/training-checkout`, {
    withCredentials: false,
  })
  return data
}
