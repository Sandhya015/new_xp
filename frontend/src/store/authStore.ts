import { create } from 'zustand'

const AUTH_KEY = 'xpertintern_auth'

const DEFAULT_ACCESS_SEC = 7 * 86400

export interface User {
  id: string
  name: string
  email: string
  role?: 'student' | 'admin' | 'company'
  companyName?: string
  hrName?: string
  mobile?: string
  university?: string
  course?: string
  semester?: string
  stream?: string
  collegeName?: string
  collegeRegNo?: string
  /** Public URL path e.g. `/api/auth/media/profile/....jpg` */
  profilePhotoUrl?: string
}

interface AuthState {
  user: User | null
  token: string | null
  /** Wall-clock ms when access token should be treated as expired (client-side). */
  tokenExpiresAt: number | null
  setUser: (user: User | null) => void
  setToken: (token: string | null, expiresInSeconds?: number | null) => void
  setSession: (user: User | null, token: string | null, expiresInSeconds?: number | null) => void
  logout: () => void
}

type StoredShape = { user: User | null; token: string | null; expiresAt?: number | null }

function loadStored(): { user: User | null; token: string | null; tokenExpiresAt: number | null } {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return { user: null, token: null, tokenExpiresAt: null }
    const data = JSON.parse(raw) as StoredShape
    if (data.token && data.user) {
      let exp: number | null = typeof data.expiresAt === 'number' ? data.expiresAt : null
      if (exp == null) {
        exp = Date.now() + DEFAULT_ACCESS_SEC * 1000
      }
      return { user: data.user, token: data.token, tokenExpiresAt: exp }
    }
  } catch {
    /* ignore */
  }
  return { user: null, token: null, tokenExpiresAt: null }
}

function saveStored(user: User | null, token: string | null, expiresAt: number | null) {
  try {
    if (token && user) {
      const payload: StoredShape = { user, token, expiresAt: expiresAt ?? undefined }
      localStorage.setItem(AUTH_KEY, JSON.stringify(payload))
    } else localStorage.removeItem(AUTH_KEY)
  } catch {
    /* ignore */
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadStored(),
  setUser: (user) =>
    set((s) => {
      saveStored(user, s.token, s.tokenExpiresAt)
      return { user }
    }),
  setToken: (token, expiresInSeconds) =>
    set((s) => {
      const exp =
        token && expiresInSeconds != null && expiresInSeconds > 0
          ? Date.now() + expiresInSeconds * 1000
          : token
            ? Date.now() + DEFAULT_ACCESS_SEC * 1000
            : null
      saveStored(s.user, token, exp)
      return { token, tokenExpiresAt: exp }
    }),
  setSession: (user, token, expiresInSeconds) =>
    set(() => {
      const exp =
        token && user && expiresInSeconds != null && expiresInSeconds > 0
          ? Date.now() + expiresInSeconds * 1000
          : token && user
            ? Date.now() + DEFAULT_ACCESS_SEC * 1000
            : null
      saveStored(user, token, exp)
      return { user, token, tokenExpiresAt: exp }
    }),
  logout: () => {
    saveStored(null, null, null)
    set({ user: null, token: null, tokenExpiresAt: null })
  },
}))
