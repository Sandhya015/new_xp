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
  ChevronDown,
  Menu,
  X,
  Settings,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const SIDEBAR_LINKS = [
  { to: '/dashboard', label: 'Home / Dashboard', icon: Home },
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
  for (const seg of segments) {
    acc += `/${seg}`
    const label = names[seg] ?? seg
    crumbs.push({ label: label.charAt(0).toUpperCase() + label.slice(1), path: acc })
  }
  return crumbs
}

export function StudentLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const path = location.pathname
  const breadcrumbs = getBreadcrumbs(path)
  const displayName = user?.name ?? 'Student'
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  const unreadNotifCount = 3

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
        {/* Top header bar */}
        <header className="shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="md:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                aria-label="Toggle menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <Link to="/dashboard" className="hidden sm:block shrink-0">
                <img src="/logo.png" alt="XpertIntern" className="h-7 w-auto object-contain" />
              </Link>
              <div className="flex-1 max-w-xl mx-auto w-full hidden md:block">
                <input
                  type="search"
                  placeholder="Search training & internships..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
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
                        to="/dashboard/notifications"
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
                  className="flex items-center gap-2 sm:gap-3 rounded-lg border border-gray-200 bg-gray-50 pl-2 pr-2 sm:pr-3 py-1.5 hover:bg-gray-100 transition"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent text-xs font-semibold text-white">
                    {initials}
                  </div>
                  <div className="text-left min-w-0 hidden md:block">
                    <p className="text-sm font-semibold text-brand-navy truncate">{displayName}</p>
                    <p className="text-xs text-slate-gray">Student</p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                      <Link
                        to="/dashboard/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User className="h-4 w-4" /> My Profile
                      </Link>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="h-4 w-4" /> Settings
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
          {/* Breadcrumb */}
          <div className="px-4 sm:px-6 pb-2 flex items-center gap-1.5 text-xs text-slate-gray flex-wrap">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-brand-navy">{crumb.label}</span>
                ) : (
                  <Link to={crumb.path} className="hover:text-brand-accent transition">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
