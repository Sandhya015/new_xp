import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Home, Link2, Ticket, ListOrdered, Wallet, BookOpen, HelpCircle, User, LogOut, Menu, Bell } from 'lucide-react'
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

export function PartnerLayout() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState<Array<Record<string, unknown>>>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!token || user?.role !== 'partner') {
      navigate('/partner/login', { replace: true })
      return
    }
    if (user?.forcePasswordChange) {
      navigate('/change-password?forced=1', { replace: true })
    }
  }, [token, user, navigate])

  useEffect(() => {
    if (!token || user?.role !== 'partner') return
    partnerService.me().then((r) => setUnread(r.unreadNotifications || 0)).catch(() => undefined)
  }, [token, user])

  const loadNotifs = () => {
    partnerService.notifications().then((r) => setNotifs(r.items || [])).catch(() => setNotifs([]))
  }

  if (!token || user?.role !== 'partner') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden md:flex w-56 flex-col border-r bg-white">
        <div className="p-4 font-bold text-brand-navy">XpertIntern Partner</div>
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-brand-accent/10 text-brand-accent font-semibold' : 'text-gray-700 hover:bg-gray-50'}`
              }
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={() => { logout(); navigate('/partner/login') }} className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3">
          <button type="button" className="md:hidden p-2" onClick={() => setOpen((o) => !o)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-medium text-brand-navy">{user?.name || 'Partner'}</div>
          <div className="relative">
            <button
              type="button"
              className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              onClick={() => {
                setNotifOpen((o) => !o)
                if (!notifOpen) loadNotifs()
              }}
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
                <div className="absolute right-0 top-full mt-1 z-20 w-80 max-h-96 overflow-auto rounded-xl border bg-white py-2 shadow-lg">
                  <div className="flex items-center justify-between px-3 pb-2 border-b">
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
                    <div key={String(n.id)} className={`px-3 py-2 text-xs border-b last:border-0 ${n.read ? 'opacity-70' : 'bg-emerald-50/40'}`}>
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
        </header>
        {open ? (
          <div className="md:hidden border-b bg-white px-2 py-2 space-y-1">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm">
                {item.label}
              </NavLink>
            ))}
          </div>
        ) : null}
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
        <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-white flex justify-around py-2 z-40">
          {NAV.slice(0, 5).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="flex flex-col items-center text-[10px] text-gray-600">
              <item.icon className="h-5 w-5" />
              {item.label.split(' ')[0]}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
