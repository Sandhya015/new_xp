/** Must match backend ADMIN_PANEL_ALLOWED_EMAIL (Vite bakes this at build time). */
export const ADMIN_PANEL_ALLOWED_EMAIL = (
  (import.meta.env.VITE_ADMIN_PANEL_ALLOWED_EMAIL as string | undefined) || 'admin@xpertintern.com'
)
  .trim()
  .toLowerCase()

export function isSuperAdminPanelUser(user: { email?: string; role?: string } | null | undefined): boolean {
  return (
    user?.role === 'admin' &&
    (user.email || '').trim().toLowerCase() === ADMIN_PANEL_ALLOWED_EMAIL
  )
}

export function isStudentUser(user: { role?: string } | null | undefined): boolean {
  return user?.role === 'student'
}

export function isCompanyUser(user: { role?: string } | null | undefined): boolean {
  return user?.role === 'company'
}
