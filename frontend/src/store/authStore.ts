import { create } from 'zustand'

const AUTH_KEY = 'xpertintern_auth'

interface User {
  id: string
  name: string
  email: string
  role?: 'student' | 'admin' | 'company'
  companyName?: string
  hrName?: string
  university?: string
  course?: string
  semester?: string
  stream?: string
  collegeName?: string
}

interface AuthState {
  user: User | null
  token: string | null
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void
}

function loadStored(): { user: User | null; token: string | null } {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return { user: null, token: null }
    const data = JSON.parse(raw) as { user: User | null; token: string | null }
    if (data.token && data.user) return { user: data.user, token: data.token }
  } catch {
    /* ignore */
  }
  return { user: null, token: null }
}

function saveStored(user: User | null, token: string | null) {
  try {
    if (token && user) localStorage.setItem(AUTH_KEY, JSON.stringify({ user, token }))
    else localStorage.removeItem(AUTH_KEY)
  } catch {
    /* ignore */
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadStored(),
  setUser: (user) => set((s) => {
    saveStored(user, s.token)
    return { user }
  }),
  setToken: (token) => set((s) => {
    saveStored(s.user, token)
    return { token }
  }),
  logout: () => {
    saveStored(null, null)
    set({ user: null, token: null })
  },
}))
