import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  Link2,
  Ticket,
  ListOrdered,
  Wallet,
  BookOpen,
  HelpCircle,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { partnerService } from '@/services/partnerService'

const NAV = [
  { to: '/partner', label: 'Overview', icon: Home, end: true },
  { to: '/partner/links', label: 'My Links', icon: Link2 },
  { to: '/partner/coupons', label: 'My Coupons', icon: Ticket },
  { to: '/partner/referrals', label: 'Referrals', icon: ListOrdered },
  { to: '/partner/payouts', label: 'Payouts', icon: Wallet },
  { to: '/partner/marketing', label: 'Marketing Kit', icon: BookOpen },
  { to: '/partner/support', label: 'Support', icon: HelpCircle },
  { to: '/partner/profile', label: 'Profile', icon: User },
]

const CRUMB_NAMES: Record<string, string> = {
  links: 'My Links',
  coupons: 'My Coupons',
  referrals: 'Referrals',
  payouts: 'Payouts',
  marketing: 'Marketing Kit',
  support: 'Support',
  profile: 'Profile',
}

function breadcrumbLabel(pathname: string): string {
  const seg = pathname.replace(/^\/partner\/?/, '').split('/').filter(Boolean)[0]
  if (!seg) return 'Overview'
  return CRUMB_NAMES[seg] || seg.charAt(0).toUpperCase() + seg.slice(1)
}

export function PartnerLayout() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [notifs, setNotifs] = useState<Array<Record<string, unknown>>>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!token || user?.role !== 'partner') {
      navigate('/partner/login', { replace: true })
      return
    }
    if (user?.forcePasswordChange) {
      navigate('/change-password?forced=1&next=/partner', { replace: true })
    }
  }, [token, user, navigate])

  useEffect(() => {
    if (!token || user?.role !== 'partner') return
    partnerService.me().then((r) => setUnread(r.unreadNotifications || 0)).catch(() => undefined)
  }, [token, user, location.pathname])

  const loadNotifs = () => {
    partnerService.notifications().then((r) => setNotifs(r.items || [])).catch(() => setNotifs([]))
  }

  const closeSidebar = () => setSidebarOpen(false)

  const handleLogout = () => {
    setLogoutConfirmOpen(false)
    logout()
    navigate('/partner/login', { replace: true })
  }

  if (!token || user?.role !== 'partner') {
    return null
  }

  const pageTitle = breadcrumbLabel(location.pathname)
  const initials = (user?.name || 'P')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex w-full min-h-screen h-screen min-w-0">
      {logoutConfirmOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="rounded-xl bg-white p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold text-brand-navy">Logout</h3>
            <p className="mt-2 text-sm text-slate-gray">Are you sure you want to logout from the Partner Portal?</p>
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
      ) : null}

      {sidebarOpen ? (
        <button type="button" onClick={closeSidebar} className="fixed inset-0 z-40 bg-black/50 md:hidden" aria-label="Close menu" />
      ) : null}

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
            <Link to="/partner" onClick={closeSidebar} className="flex items-center gap-2 min-w-0">
              <img src="/logo.png" alt="XpertIntern" className="h-8 w-auto object-contain shrink-0" />
              <span className="text-base font-semibold text-white truncate">Partner Portal</span>
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
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
                      isActive ? 'bg-[#2A303D] text-white' : 'text-white/90 hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/10 p-4">
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
              <span className="text-base font-semibold text-brand-navy truncate">{pageTitle}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((o) => !o)
                    if (!notifOpen) loadNotifs()
                  }}
                  className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unread > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </button>
                {notifOpen ? (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-80 max-h-96 overflow-auto rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
                      <div className="flex items-center justify-between px-4 pb-2 border-b">
                        <p className="text-xs font-semibold uppercase text-slate-gray">Notifications</p>
                        <button
                          type="button"
                          className="text-xs text-brand-accent"
                          onClick={async () => {
                            await partnerService.markNotificationsRead(true)
                            setUnread(0)
                            loadNotifs()
                          }}
                        >
                          Mark all read
                        </button>
                      </div>
                      {notifs.map((n) => (
                        <div key={String(n.id)} className={`px-4 py-2 text-xs border-b last:border-0 ${n.read ? 'opacity-70' : 'bg-emerald-50/40'}`}>
                          <p className="font-medium text-brand-navy">{String(n.title)}</p>
                          <p className="text-slate-gray mt-0.5">{String(n.message)}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{String(n.createdAt)}</p>
                        </div>
                      ))}
                      {!notifs.length ? <p className="p-4 text-center text-sm text-slate-gray">No notifications yet</p> : null}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 pl-2 pr-3 py-1.5 hover:bg-gray-100 transition"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent text-xs font-semibold text-white">
                    {initials}
                  </div>
                  <div className="text-left min-w-0 hidden md:block">
                    <p className="text-sm font-semibold text-brand-navy truncate max-w-[10rem]">{user?.name || 'Partner'}</p>
                    <p className="text-xs text-slate-gray truncate max-w-[10rem]">{user?.email || ''}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                </button>
                {profileOpen ? (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                      <Link
                        to="/partner/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User className="h-4 w-4" /> Profile
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false)
                          setLogoutConfirmOpen(true)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" /> Logout
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
