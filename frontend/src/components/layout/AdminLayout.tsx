import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
} from 'lucide-react'

const SIDEBAR_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: Home },
  { to: '/admin/courses', label: 'Training', icon: BookOpen },
  { to: '/admin/certificates', label: 'Certificates', icon: Award },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/leads', label: 'Leads', icon: MessageSquare },
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/companies', label: 'Companies', icon: Building2, badge: 3 },
  { to: '/admin/internships', label: 'Internships', icon: Briefcase, badge: 2 },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/admins', label: 'Admins', icon: Shield },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

function getBreadcrumbs(pathname: string): { label: string; path: string }[] {
  const segments = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean)
  const crumbs = [{ label: 'Dashboard', path: '/admin' }]
  let acc = '/admin'
  const names: Record<string, string> = {
    courses: 'Training',
    certificates: 'Certificates',
    payments: 'Payments',
    leads: 'Leads',
    students: 'Students',
    companies: 'Companies',
    internships: 'Internships',
    reports: 'Reports',
    notifications: 'Notifications',
    admins: 'Admins',
    settings: 'Settings',
  }
  for (const seg of segments) {
    acc += `/${seg}`
    const label = names[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
    crumbs.push({ label, path: acc })
  }
  return crumbs
}

export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const path = location.pathname
  const breadcrumbs = getBreadcrumbs(path)
  const unreadNotifCount = 2

  const handleLogout = () => {
    setLogoutConfirmOpen(false)
    navigate('/admin/login')
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
          fixed inset-y-0 left-0 z-50 w-56 shrink-0 bg-[#202636] flex flex-col
          md:static md:z-auto
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="h-14 shrink-0 flex items-center border-b border-white/10 px-4">
          <div className="flex items-center justify-between gap-2 w-full min-w-0">
            <Link to="/admin" onClick={closeSidebar} className="flex items-center gap-2 min-w-0">
              <img src="/logo.png" alt="XpertIntern" className="h-8 w-auto object-contain shrink-0" />
              <span className="text-base font-semibold text-white truncate">Admin Panel</span>
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
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-0.5 px-2">
            {SIDEBAR_LINKS.map(({ to, label, icon: Icon, badge }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/admin'}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
                      isActive ? 'bg-[#2A303D] text-white' : 'text-white/90 hover:bg-white/10'
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
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/10 p-4 space-y-0.5">
          <Link
            to="/"
            onClick={closeSidebar}
            className="flex items-center gap-3 px-4 py-2.5 text-base font-medium text-white/90 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Globe className="h-5 w-5 shrink-0" />
            Public Site
          </Link>
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
                    SA
                  </div>
<div className="text-left min-w-0 hidden md:block">
                <p className="text-base font-semibold text-brand-navy truncate">Super Admin</p>
                <p className="text-sm text-slate-gray">admin@xpertintern.com</p>
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
