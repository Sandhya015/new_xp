import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Plus,
  ListChecks,
  Users,
  CheckSquare,
  BarChart3,
  HelpCircle,
  Globe,
  LogOut,
  Bell,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const SIDEBAR_LINKS = [
  {
    section: 'MAIN',
    items: [
      { to: '/company', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/company/profile', label: 'Company Profile', icon: Building2 },
      { to: '/company/post-internship', label: 'Post Internship', icon: Plus },
      { to: '/company/internships', label: 'Manage Internships', icon: ListChecks, badge: 3 },
      { to: '/company/applicants', label: 'Applicants', icon: Users, badge: 12 },
      { to: '/company/selected', label: 'Selected Candidates', icon: CheckSquare },
      { to: '/company/reports', label: 'Reports', icon: BarChart3 },
      { to: '/company/support', label: 'Help & Support', icon: HelpCircle },
    ],
  },
]

function getPageTitle(pathname: string): string {
  if (pathname === '/company' || pathname === '/company/') return 'Dashboard'
  const titles: Record<string, string> = {
    '/company/profile': 'Company Profile',
    '/company/post-internship': 'Post Internship',
    '/company/internships': 'Manage Internships',
    '/company/applicants': 'Applicants',
    '/company/selected': 'Selected Candidates',
    '/company/reports': 'Reports',
    '/company/support': 'Help & Support',
  }
  return titles[pathname] ?? 'Dashboard'
}

const DEFAULT_COMPANY_NAME = 'TechSolutions Pvt. Ltd.'
const DEFAULT_HR_NAME = 'Neha Sharma'

export function CompanyLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const path = location.pathname
  const pageTitle = getPageTitle(path)
  const companyName = user?.companyName ?? DEFAULT_COMPANY_NAME
  const hrName = user?.hrName ?? DEFAULT_HR_NAME
  const initials = companyName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleLogout = () => {
    logout()
    navigate('/login')
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
          fixed inset-y-0 left-0 z-50 w-56 shrink-0 bg-[#1A2B4D] flex flex-col
          md:static md:z-auto
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <Link to="/company" onClick={closeSidebar} className="flex items-center">
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
          {SIDEBAR_LINKS.map(({ section, items }) => (
            <div key={section} className="mb-6">
              <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                {section}
              </p>
              <ul className="space-y-0.5">
                {items.map(({ to, label, icon: Icon, badge }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={to === '/company'}
                      onClick={closeSidebar}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive ? 'bg-primary-500 text-white' : 'text-white/90 hover:bg-white/10'
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
                ))}
              </ul>
            </div>
          ))}
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
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
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
              <p className="text-sm text-slate-gray mt-0.5 truncate">Company: {companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 sm:gap-3 rounded-lg border border-gray-200 bg-gray-50 pl-2 pr-2 sm:pr-3 py-1.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent text-xs font-semibold text-white">
                {initials}
              </div>
              <div className="text-left min-w-0 hidden md:block">
                <p className="text-sm font-semibold text-brand-navy truncate">{companyName}</p>
                <p className="text-xs text-slate-gray">HR: {hrName}</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 hidden sm:block" />
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
