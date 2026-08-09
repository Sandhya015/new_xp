import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Home, Link2, Ticket, ListOrdered, Wallet, BookOpen, HelpCircle, User, LogOut, Menu } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useState } from 'react'

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

  useEffect(() => {
    if (!token || user?.role !== 'partner') {
      navigate('/partner/login', { replace: true })
      return
    }
    if (user?.forcePasswordChange) {
      navigate('/change-password?forced=1', { replace: true })
    }
  }, [token, user, navigate])

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
        {/* Mobile bottom nav */}
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
