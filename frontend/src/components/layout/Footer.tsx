import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, ChevronRight, Linkedin, Instagram, Facebook, Youtube, Twitter } from 'lucide-react'

const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/training', label: 'Training' },
  { to: '/internship', label: 'Internship' },
  { to: '/verify', label: 'Certificate Verification' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/login', label: 'Register / Login' },
]
const legalLinks = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms and Conditions' },
  { to: '/refund', label: 'Refund & Cancellation Policy' },
  { to: '/certificate-policy', label: 'Certificate Authenticity Policy' },
  { to: '/disclaimer', label: 'Disclaimer' },
]
const supportLinks = [
  { to: '/contact', label: 'Contact Us' },
  { to: '/faq', label: 'Help & FAQ' },
  { to: '/about', label: 'About Us' },
]

export function Footer() {
  return (
    <footer className="bg-primary-950 border-t border-white/10 text-gray-400">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:py-8 sm:px-6 lg:px-8 min-w-0">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 col-span-2 md:col-span-1">
            <Link to="/" className="inline-block focus:outline-none focus:ring-2 focus:ring-primary-400 rounded">
              <img src="/logo.png" alt="XpertIntern" className="h-11 sm:h-12 w-auto object-contain" />
            </Link>
            <p className="mt-1.5 text-sm leading-relaxed line-clamp-2 sm:line-clamp-none">Training and internship platform providing university-based programs across India.</p>
            <div className="mt-3 space-y-1.5 sm:space-y-2 text-sm break-words">
              <a href="mailto:support@xpertintern.com" className="flex items-center gap-2 hover:text-white transition break-all">
                <Mail className="h-4 w-4 flex-shrink-0" /> support@xpertintern.com
              </a>
              <a href="tel:+919876543210" className="flex items-center gap-2 hover:text-white transition">
                <Phone className="h-4 w-4 flex-shrink-0" /> +91 9876543210
              </a>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0" /> Patna, Bihar, India
              </span>
            </div>
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">Quick Links</h3>
            <ul className="mt-1.5 sm:mt-2.5 space-y-1 sm:space-y-2">
              {quickLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="flex items-center gap-1.5 text-sm hover:text-white transition">
                    <ChevronRight className="h-4 w-4 shrink-0" /> {label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/admin/login" className="flex items-center gap-1.5 text-sm hover:text-white transition">
                  <ChevronRight className="h-4 w-4 shrink-0" /> Admin Login
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">Legal & Policies</h3>
            <ul className="mt-1.5 sm:mt-2.5 space-y-1 sm:space-y-2">
              {legalLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="flex items-center gap-1.5 text-sm hover:text-white transition">
                    <ChevronRight className="h-4 w-4 shrink-0" /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-2 md:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-0">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">Support</h3>
              <ul className="mt-1.5 sm:mt-2.5 space-y-1 sm:space-y-2">
                {supportLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="flex items-center gap-1.5 text-sm hover:text-white transition">
                      <ChevronRight className="h-4 w-4 shrink-0" /> {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">Follow Us</h3>
              <div className="mt-1.5 sm:mt-2.5 flex flex-wrap gap-2">
                <a href="#" className="text-gray-500 hover:text-white transition" aria-label="LinkedIn"><Linkedin className="h-5 w-5" /></a>
                <a href="#" className="text-gray-500 hover:text-white transition" aria-label="Instagram"><Instagram className="h-5 w-5" /></a>
                <a href="#" className="text-gray-500 hover:text-white transition" aria-label="YouTube"><Youtube className="h-5 w-5" /></a>
                <a href="#" className="text-gray-500 hover:text-white transition" aria-label="Facebook"><Facebook className="h-5 w-5" /></a>
                <a href="#" className="text-gray-500 hover:text-white transition" aria-label="Twitter/X"><Twitter className="h-5 w-5" /></a>
                <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition" aria-label="WhatsApp">WhatsApp</a>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <span>© {new Date().getFullYear()} XpertIntern. All Rights Reserved.</span>
          <Link to="/sitemap" className="hover:text-white transition">Sitemap</Link>
        </div>
      </div>
    </footer>
  )
}
