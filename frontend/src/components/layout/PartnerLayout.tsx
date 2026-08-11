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
  Bell,
  ChevronDown,
  BadgeCheck,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { partnerService } from '@/services/partnerService'
import { PartnerProvider, usePartner } from '@/context/PartnerContext'
import { partnerInitials } from '@/components/partner/PartnerUI'
import { ConsoleBrandMark } from '@/components/brand/ConsoleBrandMark'

const NAV = [
  { to: '/partner', label: 'Overview', icon: Home, end: true },
  { to: '/partner/links', label: 'My Links', icon: Link2 },
  { to: '/partner/coupons', label: 'My Coupons', icon: Ticket },
  { to: '/partner/referrals', label: 'Referrals', icon: ListOrdered },
  { to: '/partner/payouts', label: 'Payouts', icon: Wallet },
  { to: '/partner/marketing', label: 'Marketing Kit', icon: BookOpen },
  { to: '/partner/support', label: 'Support', icon: HelpCircle, badge: true },
  { to: '/partner/profile', label: 'Profile', icon: User },
]

function PartnerShell() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const { partner, unreadNotifications, loading } = usePartner()
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
      navigate('/change-password?forced=1&next=/partner&from=partner', { replace: true })
    }
  }, [token, user, navigate])

  useEffect(() => {
    setUnread(unreadNotifications)
  }, [unreadNotifications])

  const loadNotifs = () => {
    partnerService.notifications().then((r) => setNotifs(r.items || [])).catch(() => setNotifs([]))
  }

  const closeSidebar = () => setSidebarOpen(false)

  const handleLogout = () => {
    setLogoutConfirmOpen(false)
    logout()
    navigate('/partner/login', { replace: true })
  }

  if (!token || user?.role !== 'partner') return null

  const name = String(partner?.fullName || user?.name || 'Partner')
  const code = String(partner?.partnerCode || '')
  const commission = Number(partner?.commissionPercent || 0)
  const initials = partnerInitials(name)

  return (
    <div className="flex w-full min-h-screen h-screen min-w-0 bg-[#F8F9FB]">
      {logoutConfirmOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="rounded-2xl bg-white p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold text-[#0f172a]">Logout</h3>
            <p className="mt-2 text-sm text-slate-gray">Are you sure you want to logout from the Partner Portal?</p>
            <div className="mt-6 flex gap-3 justify-end">
              <button type="button" onClick={() => setLogoutConfirmOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={handleLogout} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
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
          console-sidebar-shell
          fixed inset-y-0 left-0 z-50 w-56 shrink-0 flex flex-col bg-[#202636] text-white
          md:static md:z-auto
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/10">
          <Link to="/partner" onClick={closeSidebar} className="block">
            <ConsoleBrandMark subtitle="Partner Portal" size="sm" />
          </Link>
        </div>

        <div className="mx-3 mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40 mb-2">Partner account</p>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-accent text-sm font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{loading ? '…' : name}</p>
              <p className="truncate text-[11px] text-white/50 font-mono">{code || '—'}</p>
            </div>
            <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-label="Verified" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-0.5">
            {NAV.map(({ to, label, icon: Icon, end, badge }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-4 py-2.5 text-base font-medium transition-colors ${
                      isActive
                        ? 'console-sidebar-nav-active bg-[#2A303D] text-white'
                        : 'text-white/90 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                  {badge && unread > 0 ? (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold">
                      {Math.min(unread, 9)}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 p-3 space-y-2">
          <div className="rounded-lg bg-[#2A303D] border border-white/10 p-3">
            <p className="text-xs font-semibold text-white">Need help?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/50">Partner support replies within 24 hours.</p>
            <Link to="/partner/support" onClick={closeSidebar} className="mt-2 inline-block text-xs font-semibold text-brand-accent hover:underline">
              Contact support
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 flex items-center border-b border-gray-200/80 bg-white px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 w-full min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="md:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden md:block flex-1" />
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((o) => !o)
                    if (!notifOpen) loadNotifs()
                  }}
                  className="relative rounded-xl p-2.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unread > 0 ? (
                    <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </button>
                {notifOpen ? (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-80 max-h-96 overflow-auto rounded-2xl border border-gray-200 bg-white py-2 shadow-xl">
                      <div className="flex items-center justify-between px-4 pb-2 border-b">
                        <p className="text-xs font-semibold uppercase text-slate-gray">Notifications</p>
                        <button
                          type="button"
                          className="text-xs text-brand-accent font-medium"
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
                        <div key={String(n.id)} className={`px-4 py-2.5 text-xs border-b last:border-0 ${n.read ? 'opacity-70' : 'bg-blue-50/50'}`}>
                          <p className="font-semibold text-[#0f172a]">{String(n.title)}</p>
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
                  className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white pl-1.5 pr-3 py-1.5 hover:bg-gray-50 transition shadow-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent text-xs font-bold text-white">
                    {initials}
                  </div>
                  <div className="text-left min-w-0 hidden sm:block">
                    <p className="text-sm font-semibold text-[#0f172a] truncate max-w-[9rem]">{name}</p>
                    <p className="text-[11px] text-slate-gray">{commission ? `${commission}% commission` : 'Partner'}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 hidden sm:block" />
                </button>
                {profileOpen ? (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                      <Link to="/partner/profile" onClick={() => setProfileOpen(false)} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
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

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 w-full">
          <Outlet key={location.pathname} />
        </main>
      </div>
    </div>
  )
}

export function PartnerLayout() {
  return (
    <PartnerProvider>
      <PartnerShell />
    </PartnerProvider>
  )
}
