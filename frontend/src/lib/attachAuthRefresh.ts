import type { InternalAxiosRequestConfig } from 'axios'
import { ensureFreshAccessToken } from '@/lib/tokenLifecycle'

/** Run before attaching Authorization on student/admin API clients (P-1). */
export async function runBeforeAuthorizedRequest(config: InternalAxiosRequestConfig): Promise<void> {
  const url = String(config.url || '')
  if (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/admin/login') ||
    url.includes('/api/auth/register') ||
    url.includes('/api/auth/refresh')
  ) {
    return
  }
  await ensureFreshAccessToken()
}
