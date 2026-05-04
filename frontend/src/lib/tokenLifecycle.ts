import axios from 'axios'
import { getApiBase } from '@/config/api'
import { useAuthStore } from '@/store/authStore'

let inflight: Promise<void> | null = null

function defaultExpiresSeconds(): number {
  return 7 * 86400
}

/**
 * Refreshes the access token when it is close to expiry (P-1 client alignment).
 * Call from Axios request interceptors (not from /auth/login or /auth/refresh).
 */
export async function ensureFreshAccessToken(): Promise<void> {
  const { token, tokenExpiresAt, setToken, logout } = useAuthStore.getState()
  if (!token) return
  const exp = tokenExpiresAt
  if (!exp || Date.now() < exp - 120_000) return
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const { data } = await axios.post<{ token?: string; expiresIn?: number }>(
        `${getApiBase()}/api/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      const next = typeof data?.token === 'string' ? data.token : ''
      if (!next) {
        logout()
        return
      }
      const sec = typeof data.expiresIn === 'number' && data.expiresIn > 0 ? data.expiresIn : defaultExpiresSeconds()
      setToken(next, sec)
    } catch {
      logout()
    } finally {
      inflight = null
    }
  })()
  return inflight
}
