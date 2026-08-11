import { useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { capturePartnerRefFromUrl } from '@/lib/partnerRef'
import { Footer } from '@/components/layout/Footer'

const NAV = [
  { href: '#benefits', label: 'Benefits' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#application', label: 'Application' },
  { href: '#faq', label: 'FAQs' },
]

function scrollToHash(hash: string) {
  const id = hash.replace('#', '')
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function AffiliatePartnerNav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const onLanding = location.pathname === '/apply-partner' || location.pathname === '/become-a-partner'

  const navClick = (href: string) => {
    setOpen(false)
    if (onLanding) {
      scrollToHash(href)
    } else {
      window.location.href = `/apply-partner${href}`
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/apply-partner" className="flex shrink-0 items-center min-w-0" onClick={() => setOpen(false)} aria-label="XpertIntern Affiliate Partner">
          <img
            src="/logo-navbar.png"
            alt="XpertIntern — Your Career Launchpad"
            className="h-9 sm:h-10 md:h-11 w-auto object-contain"
            decoding="async"
          />
        </Link>

        <nav className="hidden flex-1 justify-center md:flex">
          <ul className="flex items-center gap-6 lg:gap-8">
            <li>
              <Link to="/" className="text-sm font-medium text-[#334155] transition hover:text-brand-accent">
                Home
              </Link>
            </li>
            {NAV.map(({ href, label }) => (
              <li key={href}>
                <button
                  type="button"
                  onClick={() => navClick(href)}
                  className="text-sm font-medium text-[#334155] transition hover:text-brand-accent"
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            to="/partner/login"
            className="hidden sm:inline-flex text-sm font-semibold text-[#0f172a] hover:text-brand-accent transition"
          >
            Partner login
          </Link>
          <button
            type="button"
            onClick={() => navClick('#application')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-accent px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 transition sm:px-4"
          >
            Apply now
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-gray-100 bg-white px-4 py-3 md:hidden">
          <Link to="/" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setOpen(false)}>
            Home
          </Link>
          {NAV.map(({ href, label }) => (
            <button
              key={href}
              type="button"
              onClick={() => navClick(href)}
              className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {label}
            </button>
          ))}
          <Link to="/partner/login" className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-accent" onClick={() => setOpen(false)}>
            Partner login
          </Link>
        </div>
      ) : null}
    </header>
  )
}

function ScrollToHash() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    capturePartnerRefFromUrl()
    if (hash) {
      const id = decodeURIComponent(hash.slice(1))
      requestAnimationFrame(() => {
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }
    if (pathname === '/apply-partner') window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export function ApplyPartnerLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ScrollToHash />
      <AffiliatePartnerNav />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export function AffiliatePageWrap({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">{children}</div>
}
