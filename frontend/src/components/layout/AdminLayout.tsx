import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  Award,
  FileText,
  CreditCard,
  Filter,
  Users,
  Building2,
  Settings,
  Globe,
  LogOut,
  Bell,
  Database,
  Menu,
  X,
} from 'lucide-react'

const SIDEBAR_LINKS = [
  {
    section: 'OVERVIEW',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'CONTENT',
    items: [
      { to: '/admin/courses', label: 'Training Management', icon: GraduationCap },
      { to: '/admin/certificates', label: 'Certificate Generation', icon: Award },
      { to: '/admin/offer-letters', label: 'Offer Letters', icon: FileText },
      { to: '/admin/payments', label: 'Payments & Invoices', icon: CreditCard },
    ],
  },
  {
    section: 'MARKETING',
    items: [{ to: '/admin/leads', label: 'Lead Management', icon: Filter, badge: 24 }],
  },
  {
    section: 'USERS',
    items: [
      { to: '/admin/students', label: 'Student Management', icon: Users },
      { to: '/admin/companies', label: 'Company Management', icon: Building2, badge: 3 },
    ],
  },
  {
    section: 'SYSTEM',
    items: [
      { to: '/admin/settings', label: 'System Settings', icon: Settings },
      { to: '/', label: 'Public Site', icon: Globe },
    ],
  },
]

function getPageTitle(pathname: string): string {
  if (pathname === '/admin' || pathname === '/admin/') return 'Admin Dashboard'
  const titles: Record<string, string> = {
    '/admin/courses': 'Training Management',
    '/admin/certificates': 'Certificate Generation',
    '/admin/offer-letters': 'Offer Letters',
    '/admin/payments': 'Payments & Invoices',
    '/admin/leads': 'Lead Management',
    '/admin/students': 'Student Management',
    '/admin/companies': 'Company Management',
    '/admin/settings': 'System Settings',
  }
  return titles[pathname] ?? 'Admin'
}

export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const path = location.pathname
  const pageTitle = getPageTitle(path)

  const handleLogout = () => {
    navigate('/admin/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex w-full min-h-screen h-screen min-w-0">
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
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <Link to="/admin" onClick={closeSidebar} className="flex items-center">
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
          <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white bg-[#0F9BA5] rounded">
            ADMIN PANEL
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {SIDEBAR_LINKS.map(({ section, items }) => (
            <div key={section} className="mb-6">
              <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                {section}
              </p>
              <ul className="space-y-0.5">
                {items.map(({ to, label, icon: Icon, badge }) => {
                  const isPublicSite = label === 'Public Site'
                  if (isPublicSite) {
                    return (
                      <li key={to}>
                        <Link
                          to={to}
                          onClick={closeSidebar}
                          className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium text-white/90 hover:bg-white/10 transition-colors"
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{label}</span>
                        </Link>
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
                          `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive ? 'bg-[#2A303D] text-white' : 'text-white/90 hover:bg-white/10'
                          }`
                        }
                      >
                        <>
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{label}</span>
                          {badge != null && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">
                              {badge}
                            </span>
                          )}
                        </>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          <div className="border-t border-white/10 pt-4 mt-4 px-4">
            <button
              type="button"
              onClick={() => {
                handleLogout()
                closeSidebar()
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Logout
            </button>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FB]">
        <header className="shrink-0 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="md:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-brand-navy truncate">{pageTitle}</h1>
              <p className="text-sm text-slate-gray mt-0.5 truncate">Full system control</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
              aria-label="Database"
            >
              <Database className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 pl-2 pr-3 py-1.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                SA
              </div>
              <div className="text-left min-w-0 hidden md:block">
                <p className="text-sm font-semibold text-brand-navy truncate">Super Admin</p>
                <p className="text-xs text-slate-gray">admin@xpertintern.com</p>
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
