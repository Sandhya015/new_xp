import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { isCrmManagerUser, isCrmPortalUser, isLeadAgentOnly, isSuperAdminPanelUser } from '@/constants/adminAccess'
import {
  Home,
  BookOpen,
  Award,
  CreditCard,
  Building2,
  Briefcase,
  BarChart3,
  Bell,
  Shield,
  Settings,
  Globe,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  MessageSquare,
  GraduationCap,
  Ticket,
  HelpCircle,
  Package,
  UsersRound,
} from 'lucide-react'
import { adminPartnerService } from '@/services/partnerService'
import { crmService, type CrmSummary } from '@/services/crmService'
import { ConsoleBrandMark } from '@/components/brand/ConsoleBrandMark'
import { MANAGER_LEAD_TABS, AGENT_LEAD_TABS } from '@/pages/admin/leads/leadCommandNav'

const SIDEBAR_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: Home },
  { to: '/admin/courses', label: 'Training', icon: BookOpen },
  { to: '/admin/certificates', label: 'Documents', icon: Award },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/kit-orders', label: 'Kit Orders', icon: Package },
  { to: '/admin/leads', label: 'Leads', icon: MessageSquare },
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/partners', label: 'Partners', icon: UsersRound, expandable: true as const },
  { to: '/admin/companies', label: 'Companies', icon: Building2, badge: 3 },
  { to: '/admin/internships', label: 'Internships', icon: Briefcase, badge: 2 },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/tickets', label: 'Tickets', icon: Ticket },
  { to: '/admin/help-faq', label: 'Help & FAQ', icon: HelpCircle },
  { to: '/admin/admins', label: 'Admins', icon: Shield },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

const PARTNER_SUBLINKS = [
  { to: '/admin/partners', label: 'All partners', end: true },
  { to: '/admin/partners/applications', label: 'Applications' },
  { to: '/admin/partners/payouts', label: 'Payouts' },
]

function getBreadcrumbs(pathname: string): { label: string; path: string }[] {
  const segments = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean)
  const crumbs = [{ label: 'Dashboard', path: '/admin' }]
  let acc = '/admin'
  const names: Record<string, string> = {
    courses: 'Training',
    new: 'Add Training',
    manage: 'Manage',
    certificates: 'Documents',
    partners: 'Partners',
    applications: 'Applications',
    payouts: 'Payouts',
    payments: 'Payments',
    'kit-orders': 'Kit Orders',
    leads: 'Leads',
    overview: 'Overview',
    inbox: 'Lead Inbox',
    assignment: 'Assignment',
    'follow-ups': 'Follow-ups',
    calls: 'Calls',
    imports: 'Imports',
    people: 'People & Teams',
    'my-agents': 'My Agents',
    profile: 'Lead profile',
    students: 'Students',
    companies: 'Companies',
    internships: 'Internships',
    reports: 'Reports',
    notifications: 'Notifications',
    tickets: 'Tickets',
    'help-faq': 'Help & FAQ',
    admins: 'Admins',
    settings: 'Settings',
  }
  for (const seg of segments) {
    acc += `/${seg}`
    const label = names[seg] ?? (seg.length <= 24 && !seg.includes('-') ? seg : seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '))
    crumbs.push({ label, path: acc })
  }
  return crumbs
}

export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [pendingApps, setPendingApps] = useState(0)
  const [partnersOpen, setPartnersOpen] = useState(false)
  const path = location.pathname
  const breadcrumbs = getBreadcrumbs(path)
  const unreadNotifCount = 2
  const onPartners = path.startsWith('/admin/partners')
  const leadAgentOnly = isLeadAgentOnly(user)
  const leadManagerOnly = isCrmManagerUser(user)
  const superAdmin = isSuperAdminPanelUser(user)
  const [crmSummary, setCrmSummary] = useState<CrmSummary | null>(null)
  const [agentNavCounts, setAgentNavCounts] = useState({ assigned: 0, followUps: 0 })
  const visibleSidebarLinks = SIDEBAR_LINKS.filter((item) => {
    if (leadAgentOnly || leadManagerOnly) return item.to === '/admin/leads'
    return true
  })
  const crmWorkspaceSidebar = leadManagerOnly || leadAgentOnly
  const homePath = leadManagerOnly || leadAgentOnly ? '/admin/leads/overview' : '/admin'
  const consoleSubtitle = leadManagerOnly ? 'Manager Console' : leadAgentOnly ? 'Lead Command' : 'Admin Console'

  useEffect(() => {
    if (!token || !user) {
      const leadsPath = path.startsWith('/admin/leads') || path.startsWith('/leadmanagement')
      navigate(leadsPath ? '/leadmanagement/login' : '/admin/login', { replace: true })
      return
    }
    if (!isCrmPortalUser(user)) {
      navigate('/admin/login', { replace: true })
    }
  }, [token, user, navigate, path])

  useEffect(() => {
    if (onPartners) setPartnersOpen(true)
  }, [onPartners])

  useEffect(() => {
    if (!token || !user || !superAdmin) return
    adminPartnerService.pendingMeta().then((m) => setPendingApps(m.pendingApplications || 0)).catch(() => setPendingApps(0))
  }, [token, user, path])

  useEffect(() => {
    if (!token || !leadManagerOnly) return
    crmService.getSummary().then(setCrmSummary).catch(() => setCrmSummary(null))
  }, [token, leadManagerOnly, path])

  useEffect(() => {
    if (!token || !leadAgentOnly) return
    Promise.all([
      crmService.listLeads({ limit: 1 }),
      crmService.listLeads({ followUpDue: true, limit: 1 }),
    ])
      .then(([assigned, followUps]) => {
        setAgentNavCounts({ assigned: assigned.total, followUps: followUps.total })
      })
      .catch(() => setAgentNavCounts({ assigned: 0, followUps: 0 }))
  }, [token, leadAgentOnly, path])

  const handleLogout = () => {
    setLogoutConfirmOpen(false)
    logout()
    navigate(isLeadAgentOnly(user) || isCrmManagerUser(user) ? '/leadmanagement/login' : '/admin/login')
  }

  const handleGoToPublicSite = () => {
    closeSidebar()
    logout()
    navigate('/', { replace: true })
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex w-full min-h-screen h-screen min-w-0">
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="rounded-xl bg-white p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold text-brand-navy">Logout</h3>
            <p className="mt-2 text-sm text-slate-gray">Are you sure you want to logout from the Admin Panel?</p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {sidebarOpen && (
        <button
          type="button"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close menu"
        />
      )}

      <aside
        className={`
          console-sidebar-shell
          fixed inset-y-0 left-0 z-50 shrink-0 bg-[#202636] text-white flex flex-col
          ${crmWorkspaceSidebar ? 'w-64' : 'w-56'}
          md:static md:z-auto
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between gap-2">
            <Link to={homePath} onClick={closeSidebar} className="min-w-0">
              <ConsoleBrandMark subtitle={consoleSubtitle} size="sm" />
            </Link>
            <button
              type="button"
              onClick={closeSidebar}
              className="md:hidden rounded p-2 text-white/80 hover:bg-white/10 shrink-0"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <nav className="console-sidebar-nav flex-1 overflow-y-auto py-4">
          <ul className="space-y-0.5 px-2">
            {leadAgentOnly ? (
              <>
                <li className="px-3 pb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">My workspace</p>
                </li>
                {AGENT_LEAD_TABS.map((tab) => {
                  const Icon = tab.icon
                  const badge =
                    tab.badgeKey === 'totalOpen'
                      ? agentNavCounts.assigned
                      : tab.badgeKey === 'followUpsDue'
                        ? agentNavCounts.followUps
                        : null
                  return (
                    <li key={tab.id}>
                      <NavLink
                        to={`/admin/leads/${tab.path}`}
                        onClick={closeSidebar}
                        title={tab.label}
                        className={({ isActive }) =>
                          `flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium leading-snug transition-colors ${
                            isActive
                              ? 'bg-emerald-600/20 text-white ring-1 ring-emerald-500/35'
                              : 'text-white/90 hover:bg-white/10'
                          }`
                        }
                      >
                        <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1 min-w-0 [overflow-wrap:anywhere]">{tab.label}</span>
                        {typeof badge === 'number' && badge > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </>
            ) : leadManagerOnly ? (
              MANAGER_LEAD_TABS.map((tab) => {
                const Icon = tab.icon
                const badge = tab.badgeKey && crmSummary ? crmSummary[tab.badgeKey] : null
                return (
                  <li key={tab.id}>
                    <NavLink
                      to={`/admin/leads/${tab.path}`}
                      onClick={closeSidebar}
                      title={tab.label}
                      className={({ isActive }) =>
                        `flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium leading-snug transition-colors ${
                          isActive ? 'console-sidebar-nav-active bg-[#2A303D] text-white' : 'text-white/90 hover:bg-white/10'
                        }`
                      }
                    >
                      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                      <span className="flex-1 min-w-0 [overflow-wrap:anywhere]">{tab.label}</span>
                      {typeof badge === 'number' && badge > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                )
              })
            ) : visibleSidebarLinks.map((item) => {
              const { to, label, icon: Icon, badge } = item as typeof item & { badge?: number; expandable?: boolean }
              const expandable = 'expandable' in item && item.expandable
              if (expandable) {
                return (
                  <li key={to}>
                    <button
                      type="button"
                      onClick={() => setPartnersOpen((o) => !o)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
                        onPartners ? 'console-sidebar-nav-active bg-[#2A303D] text-white' : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-left">{label}</span>
                      {pendingApps > 0 ? (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">
                          {pendingApps}
                        </span>
                      ) : null}
                      <ChevronDown className={`h-4 w-4 shrink-0 transition ${partnersOpen || onPartners ? 'rotate-180' : ''}`} />
                    </button>
                    {(partnersOpen || onPartners) && (
                      <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-white/10 pl-2">
                        {PARTNER_SUBLINKS.map((sub) => (
                          <li key={sub.to + sub.label}>
                            <NavLink
                              to={sub.to}
                              end={!!sub.end}
                              onClick={closeSidebar}
                              className={({ isActive }) =>
                                `block rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-white/10 text-white font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white'}`
                              }
                            >
                              {sub.label}
                              {sub.to.includes('applications') && pendingApps > 0 ? (
                                <span className="ml-2 text-amber-400">({pendingApps})</span>
                              ) : null}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              }
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/admin'}
                    onClick={closeSidebar}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
                        isActive ? 'console-sidebar-nav-active bg-[#2A303D] text-white' : 'text-white/90 hover:bg-white/10'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{label}</span>
                    {badge != null && badge > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">
                        {badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
        {leadAgentOnly && (
          <div className="shrink-0 space-y-2 px-3 pb-3">
            <div className="rounded-lg bg-white/5 px-3 py-2.5 text-[11px] leading-relaxed text-white/60">
              <p className="font-semibold text-white/80">Agent access</p>
              <p className="mt-0.5">Only leads assigned to you are visible here.</p>
            </div>
            <div className="rounded-lg bg-emerald-950/40 px-3 py-2.5 text-[11px] text-emerald-100 ring-1 ring-emerald-500/20">
              <p className="font-semibold">TeleCMI connected</p>
              <p className="mt-0.5 text-emerald-200/80">Extension ready for outbound calls.</p>
            </div>
          </div>
        )}
        <div className="border-t border-white/10 p-4 space-y-0.5">
          <button
            type="button"
            onClick={handleGoToPublicSite}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-base font-medium text-white/90 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Globe className="h-5 w-5 shrink-0" />
            Public Site
          </button>
          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-base font-medium text-white/90 hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FB]">
        <header className="h-14 shrink-0 flex items-center border-b border-gray-200 bg-white px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 w-full min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="md:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                aria-label="Toggle menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <span className="text-base font-semibold text-brand-navy truncate">
                {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : 'Dashboard'}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-72 rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
                      <p className="px-4 py-2 text-xs font-semibold uppercase text-slate-gray">Recent</p>
                      <p className="px-4 py-4 text-sm text-slate-gray text-center">No new notifications</p>
                      <Link
                        to="/admin/notifications"
                        onClick={() => setNotifOpen(false)}
                        className="block px-4 py-2 text-sm font-medium text-brand-accent hover:bg-gray-50"
                      >
                        View All Notifications
                      </Link>
                    </div>
                  </>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 pl-2 pr-3 py-1.5 hover:bg-gray-100 transition"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                    {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left min-w-0 hidden md:block">
                    <p className="text-base font-semibold text-brand-navy truncate">
                      {leadManagerOnly || leadAgentOnly ? (user?.name || 'User') : 'Super Admin'}
                    </p>
                    <p className="text-sm text-slate-gray truncate">{user?.email || 'admin@xpertintern.com'}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User className="h-4 w-4" /> Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => { setProfileOpen(false); setLogoutConfirmOpen(true); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" /> Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
