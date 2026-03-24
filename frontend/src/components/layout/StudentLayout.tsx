import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  BookOpen,
  Briefcase,
  Play,
  ClipboardList,
  Award,
  CreditCard,
  Bell,
  User,
  HelpCircle,
  Globe,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const SIDEBAR_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/dashboard/training', label: 'Training', icon: BookOpen },
  { to: '/dashboard/internships', label: 'Internships', icon: Briefcase },
  { to: '/dashboard/my-courses', label: 'My Enrolled Courses', icon: Play },
  { to: '/dashboard/applied-internships', label: 'Applied Internships', icon: ClipboardList },
  { to: '/dashboard/certificates', label: 'My Certificates', icon: Award },
  { to: '/dashboard/payments', label: 'Payments & Invoices', icon: CreditCard },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: 3 },
  { to: '/dashboard/profile', label: 'My Profile', icon: User },
  { to: '/dashboard/support', label: 'Help & Support', icon: HelpCircle },
]

/** MongoDB ObjectId — avoid showing raw id in the top bar */
function isLikelyObjectId(s: string): boolean {
  return /^[a-f\d]{24}$/i.test(s)
}

function getBreadcrumbs(pathname: string): { label: string; path: string }[] {
  const segments = pathname.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean)
  const crumbs = [{ label: 'Dashboard', path: '/dashboard' }]
  let acc = '/dashboard'
  const names: Record<string, string> = {
    training: 'Training',
    internships: 'Internships',
    'my-courses': 'My Enrolled Courses',
    'applied-internships': 'Applied Internships',
    certificates: 'My Certificates',
    payments: 'Payments & Invoices',
    notifications: 'Notifications',
    profile: 'My Profile',
    support: 'Help & Support',
  }
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const prev = i > 0 ? segments[i - 1] : ''
    acc += `/${seg}`
    let label: string
    if (names[seg]) {
      label = names[seg]
    } else if (isLikelyObjectId(seg)) {
      if (prev === 'my-courses') label = 'Course content'
      else if (prev === 'training') label = 'Program detail'
      else label = 'Details'
    } else {
      label = seg.charAt(0).toUpperCase() + seg.slice(1)
    }
    crumbs.push({ label, path: acc })
  }
  return crumbs
}

export function StudentLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const path = location.pathname
  const breadcrumbs = getBreadcrumbs(path)

  const handleLogout = () => {
    setLogoutConfirmOpen(false)
    logout()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex w-full min-h-screen h-screen min-w-0">
      {/* Logout confirmation modal */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="rounded-xl bg-white p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold text-brand-navy">Logout</h3>
            <p className="mt-2 text-sm text-slate-gray">Are you sure you want to logout?</p>
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
          fixed inset-y-0 left-0 z-50 w-56 shrink-0 bg-[#1A2B4D] flex flex-col
          md:static md:z-auto
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <Link to="/dashboard" onClick={closeSidebar} className="flex items-center">
            <img src="/logo.png" alt="XpertIntern" className="h-8 w-auto object-contain" />
          </Link>
          <button
            type="button"
            onClick={closeSidebar}
            className="md:hidden rounded p-2 text-white/80 hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-0.5 px-2">
            {SIDEBAR_LINKS.map(({ to, label, icon: Icon, badge }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/dashboard'}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-primary-500 text-white' : 'text-white/90 hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                  {badge != null && badge > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
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
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Globe className="h-4 w-4 shrink-0" />
            Public Site
          </Link>
          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {/* Top bar: page name + profile name & email */}
        <header className="shrink-0 border-b border-gray-200 bg-white px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="md:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                aria-label="Toggle menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-brand-navy truncate">
                {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : 'Dashboard'}
              </h1>
            </div>
            <div className="hidden sm:flex flex-col items-end min-w-0 shrink-0">
              <p className="text-sm font-medium text-brand-navy truncate max-w-[180px]" title={user?.name ?? ''}>
                {user?.name ?? 'Student'}
              </p>
              <p className="text-xs text-slate-gray truncate max-w-[180px]" title={user?.email ?? ''}>
                {user?.email ?? ''}
              </p>
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
