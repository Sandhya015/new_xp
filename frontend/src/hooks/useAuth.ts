import { useAuthStore } from '@/store/authStore'
import { isSuperAdminPanelUser } from '@/constants/adminAccess'

export function useAuth() {
  const { user, token, logout } = useAuthStore()
  const isAuthenticated = !!token && !!user
  const isAdmin = isSuperAdminPanelUser(user)
  return { user, token, isAuthenticated, isAdmin, logout }
}
