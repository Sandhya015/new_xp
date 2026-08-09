import { useEffect, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { capturePartnerRefFromUrl } from '@/lib/partnerRef'
//this helps to scroll
function ScrollToTop() {
  const { pathname, hash, search } = useLocation()
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
    window.scrollTo(0, 0)
  }, [pathname, hash, search])
  return null
}

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1 min-w-0 pt-14 sm:pt-16">{children}</main>
      <Footer />
    </div>
  )
}
