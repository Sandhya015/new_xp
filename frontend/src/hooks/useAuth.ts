import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, token, logout } = useAuthStore()
  const isAuthenticated = !!token && !!user
  const isAdmin = user?.role === 'admin'
  return { user, token, isAuthenticated, isAdmin, logout }
}
