import { Link } from 'react-router-dom'
import {
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Instagram,
  Facebook,
  Youtube,
  X,
  Rocket,
  MessageCircle,
  Building2,
  Scale,
  CreditCard,
  Smartphone,
  Landmark,
  Wallet,
  CalendarDays,
  ShieldCheck,
  ChevronUp,
  Star,
  Lock,
} from 'lucide-react'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

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

const paymentMethods = [
  { label: 'Credit Cards', Icon: CreditCard },
  { label: 'Debit Cards', Icon: CreditCard },
  { label: 'UPI', Icon: Smartphone },
  { label: 'Net Banking', Icon: Landmark },
  { label: 'Wallet', Icon: Wallet },
  { label: 'EMI', Icon: CalendarDays },
]

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

export function Footer() {
  return (
    <footer className="bg-[#0a1128] text-gray-400">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-12 sm:px-6 lg:px-8 min-w-0">
        {/* Top: Brand + Get In Touch */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 pb-10 lg:pb-12 border-b border-white/10">
          <div className="min-w-0">
            <Link to="/" className="inline-block focus:outline-none focus:ring-2 focus:ring-primary-400 rounded">
              <img src="/logo.png" alt="XpertIntern" className="h-11 sm:h-12 w-auto object-contain" />
            </Link>
            <p className="mt-2 text-primary-300/90 text-sm">Training and internship platform for students across India.</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">University-based programs, verified certificates, and industry partnerships as per AICTE and UGC guidelines.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-300">
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /> AICTE Approved
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-300">
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /> UGC Approved
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-300">
                <Lock className="h-3.5 w-3.5 text-green-400" /> Secure Platform
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition" aria-label="LinkedIn"><Linkedin className="h-4 w-4" /></a>
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition" aria-label="Instagram"><Instagram className="h-4 w-4" /></a>
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition" aria-label="YouTube"><Youtube className="h-4 w-4" /></a>
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition" aria-label="Facebook"><Facebook className="h-4 w-4" /></a>
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition" aria-label="X (Twitter)"><X className="h-4 w-4" /></a>
              <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition" aria-label="WhatsApp"><WhatsAppIcon className="h-4 w-4" /></a>
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">Get In Touch</h3>
            <div className="mt-4 space-y-4">
              <a href="mailto:contact@xpertintern.com" className="flex items-start gap-3 group">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-gray-500">Email us at</p>
                  <p className="text-sm font-semibold text-white group-hover:text-primary-300 transition break-all">contact@xpertintern.com</p>
                </div>
              </a>
              <a href="tel:+919876543210" className="flex items-start gap-3 group">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                  <Phone className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-gray-500">Call us at</p>
                  <p className="text-sm font-semibold text-white group-hover:text-primary-300 transition">+91 9876543210</p>
                </div>
              </a>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700/30 text-emerald-400">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-gray-500">Visit us at</p>
                  <p className="text-sm font-semibold text-white">Patna, Bihar, India</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-xs text-green-400"><ShieldCheck className="h-4 w-4" /> 100% Secure</span>
              <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Star className="h-4 w-4 fill-amber-400" /> UGC Approved</span>
            </div>
          </div>
        </div>

        {/* Four columns: Platform, Support, Company, Legal */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 py-10 lg:py-12 border-b border-white/10">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
              <Rocket className="h-4 w-4 text-primary-400" /> Platform
            </h3>
            <ul className="mt-3 space-y-2">
              {quickLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-gray-400 hover:text-white transition">{label}</Link>
                </li>
              ))}
              <li>
                <Link to="/admin/login" className="text-sm text-gray-400 hover:text-white transition">Admin Login</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
              <MessageCircle className="h-4 w-4 text-primary-400" /> Support
            </h3>
            <ul className="mt-3 space-y-2">
              {supportLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-gray-400 hover:text-white transition">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
              <Building2 className="h-4 w-4 text-primary-400" /> Company
            </h3>
            <ul className="mt-3 space-y-2">
              <li><Link to="/about" className="text-sm text-gray-400 hover:text-white transition">About Us</Link></li>
              <li><Link to="/contact" className="text-sm text-gray-400 hover:text-white transition">Contact Us</Link></li>
              <li><Link to="/sitemap" className="text-sm text-gray-400 hover:text-white transition">Sitemap</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
              <Scale className="h-4 w-4 text-primary-400" /> Legal
            </h3>
            <ul className="mt-3 space-y-2">
              {legalLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-gray-400 hover:text-white transition">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Payment section */}
        <div className="my-10 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 sm:px-6 sm:py-8">
          <h3 className="text-center text-lg font-bold text-white">We Support All Payment Methods</h3>
          <p className="mt-1 text-center text-sm text-gray-400">Secure payments powered by Razorpay — India&apos;s leading payment gateway</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 sm:gap-4">
            {paymentMethods.map(({ label, Icon }) => (
              <div key={label} className="flex flex-col items-center gap-1 rounded-xl bg-white/5 px-4 py-3 min-w-[80px]">
                <Icon className="h-6 w-6 text-gray-400" />
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            Powered by Razorpay <ShieldCheck className="h-4 w-4 text-green-500 inline" /> PCI DSS Certified
          </p>
        </div>

        {/* Bottom: Copyright + Back to top */}
        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="text-center sm:text-left">
            <p>© {new Date().getFullYear()} XpertIntern. All Rights Reserved.</p>
            <p className="mt-0.5 text-xs text-gray-500">Compliant with UGC Internship Guidelines & NEP 2020</p>
          </div>
          <Link to="/sitemap" className="hover:text-white transition">Sitemap</Link>
        </div>
        <div className="flex justify-center pt-4 pb-2">
          <button
            type="button"
            onClick={scrollToTop}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition"
            aria-label="Back to top"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </footer>
  )
}
