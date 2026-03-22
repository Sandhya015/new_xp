import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/training', label: 'Training' },
  { to: '/internship', label: 'Internship' },
  { to: '/verify', label: 'Certificate Verification' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[4.5rem] sm:min-h-[5rem] items-center gap-2 py-2">
          <Link to="/" className="shrink-0 md:mr-0" aria-label="XpertIntern Home">
            <img src="/logo.png" alt="XpertIntern" className="h-12 sm:h-14 md:h-16 w-auto object-contain" />
          </Link>
          <div className="hidden md:flex flex-1 justify-center items-center min-w-0">
            <div className="flex items-center gap-5 lg:gap-6">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`text-sm font-medium transition whitespace-nowrap ${isActive(to) ? 'text-brand-accent' : 'text-brand-navy hover:text-brand-accent'}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex-1 md:flex-none flex justify-end items-center gap-2 lg:gap-3">
            <div className="hidden md:flex md:items-center md:gap-2 lg:gap-3">
              <Link
                to="/login"
                className="rounded-lg border-2 border-brand-accent bg-white px-3 lg:px-4 py-2 text-sm font-semibold text-brand-accent hover:bg-brand-light-bg transition min-h-[44px] md:min-h-0 inline-flex items-center justify-center"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-brand-accent px-3 lg:px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 transition shadow-sm min-h-[44px] md:min-h-0 inline-flex items-center justify-center"
              >
                Register
              </Link>
            </div>
            <button
              type="button"
              className="md:hidden rounded-lg p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 hover:bg-gray-100"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`block rounded-lg px-4 py-3 min-h-[44px] flex items-center text-sm font-medium ${isActive(to) ? 'bg-brand-light-bg text-brand-accent' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="pt-2 flex gap-2 px-4">
              <Link to="/login" className="flex-1 rounded-lg border-2 border-brand-accent py-3 min-h-[44px] flex items-center justify-center text-sm font-semibold text-brand-accent" onClick={() => setOpen(false)}>Login</Link>
              <Link to="/register" className="flex-1 rounded-lg bg-brand-accent py-3 min-h-[44px] flex items-center justify-center text-sm font-semibold text-white" onClick={() => setOpen(false)}>Register</Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
