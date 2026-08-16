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

export function isCrmPortalUser(
  user: { email?: string; role?: string; leadRole?: string; adminPortalAccess?: boolean } | null | undefined,
): boolean {
  if (user?.role !== 'admin') return false
  if (isSuperAdminPanelUser(user)) return true
  if (user.adminPortalAccess) return true
  const lr = (user.leadRole || '').trim()
  return lr === 'agent' || lr === 'manager' || lr === 'super_admin'
}

/** Lead counselors — Leads section only, not full admin panel. */
export function isLeadAgentOnly(
  user: { email?: string; role?: string; leadRole?: string; adminPortalAccess?: boolean } | null | undefined,
): boolean {
  return isCrmPortalUser(user) && !isSuperAdminPanelUser(user) && (user?.leadRole || '') === 'agent'
}

export function isCrmManagerUser(
  user: { email?: string; role?: string; leadRole?: string; adminPortalAccess?: boolean } | null | undefined,
): boolean {
  return isCrmPortalUser(user) && !isSuperAdminPanelUser(user) && (user?.leadRole || '') === 'manager'
}

export function isStudentUser(user: { role?: string } | null | undefined): boolean {
  return user?.role === 'student'
}

export function isCompanyUser(user: { role?: string } | null | undefined): boolean {
  return user?.role === 'company'
}
