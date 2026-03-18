import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, Send, Linkedin, Instagram, Facebook, Youtube, X } from 'lucide-react'
import { Notification } from '@/components/Notification'
import { contactService } from '@/services/contactService'

const UNIVERSITIES = [
  'BEU — Bihar Engineering University', 'SBTE — State Board of Technical Education', 'JUT — Jharkhand University of Technology',
  'AKTU — Dr. A.P.J. Abdul Kalam Technical Univ.', 'Patna University', 'Patliputra University', 'Munger University',
  'Lalit Narayan Mithila University', 'Veer Kunwar Singh University', 'Tilka Majhi Bhagalpur University',
  'Bhupendra Narayan Mandal University', 'Jai Prakash University', 'Magadh University', 'Purnea University',
  'Nalanda Open University', 'Babasaheb Bhimrao Ambedkar Bihar University',
]
const COURSES = ['B.Tech', 'Diploma', 'BA', 'BSc', 'BCom', 'BBA', 'BCA']
const STREAMS = ['CSE', 'Civil', 'Electrical', 'ECE', 'Mechanical', 'IT']
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    university: '',
    semester: '',
    course: '',
    stream: '',
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await contactService.submit({
        name: form.name,
        email: form.email,
        phone: form.phone,
        university: form.university || undefined,
        semester: form.semester || undefined,
        course: form.course || undefined,
        stream: form.stream || undefined,
        message: form.message || undefined,
      })
      setSubmitted(true)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to submit. Please try again.'
      setError(msg || 'Failed to submit.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-w-0">
      {/* Hero — dark blue banner */}
      <section className="bg-gradient-to-br from-brand-navy via-primary-800 to-primary-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:py-20 sm:px-6 lg:px-8">
          <nav className="text-sm text-primary-200" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white transition">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-white font-medium">Contact Us</span>
          </nav>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Get In Touch
          </h1>
          <p className="mt-3 text-lg text-primary-200">
            We&apos;re here to help. Reach out to us anytime.
          </p>
        </div>
      </section>

      {/* Main content — two columns */}
      <section className="bg-white py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
            {/* Left: Contact Information */}
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-brand-navy sm:text-2xl">
                Contact Information
              </h2>

              <div className="mt-8 space-y-8">
                {/* Email */}
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                    <Mail className="h-6 w-6 text-brand-accent" />
                  </div>
                  <div>
                    <p className="font-bold text-brand-navy">Email</p>
                    <a href="mailto:info@xpertintern.com" className="mt-1 block text-slate-gray hover:text-brand-accent transition">
                      info@xpertintern.com
                    </a>
                    <a href="mailto:contact@xpertintern.com" className="mt-0.5 block text-slate-gray hover:text-brand-accent transition">
                      contact@xpertintern.com
                    </a>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                    <Phone className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-brand-navy">Phone</p>
                    <a href="tel:+919876543210" className="mt-1 block text-slate-gray hover:text-brand-accent transition">
                      +91 9876543210
                    </a>
                    <p className="mt-1 text-sm text-slate-gray">Mon-Sat: 9AM - 6PM</p>
                  </div>
                </div>

                {/* Address */}
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                    <MapPin className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-brand-navy">Address</p>
                    <p className="mt-1 text-slate-gray">
                      XpertIntern Headquarters<br />
                      Patna, Bihar - 800001<br />
                      India
                    </p>
                  </div>
                </div>

                {/* Follow Us */}
                <div>
                  <p className="font-bold text-brand-navy">Follow Us</p>
                  <div className="mt-3 flex gap-2">
                    <a
                      href="#"
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A66C2] text-white hover:opacity-90 transition"
                      aria-label="LinkedIn"
                    >
                      <Linkedin className="h-5 w-5" />
                    </a>
                    <a
                      href="#"
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-pink-500 text-white hover:opacity-90 transition"
                      aria-label="Instagram"
                    >
                      <Instagram className="h-5 w-5" />
                    </a>
                    <a
                      href="#"
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1877F2] text-white hover:opacity-90 transition"
                      aria-label="Facebook"
                    >
                      <Facebook className="h-5 w-5" />
                    </a>
                    <a
                      href="#"
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF0000] text-white hover:opacity-90 transition"
                      aria-label="YouTube"
                    >
                      <Youtube className="h-5 w-5" />
                    </a>
                    <a
                      href="#"
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white hover:opacity-90 transition"
                      aria-label="X (Twitter)"
                    >
                      <X className="h-5 w-5" />
                    </a>
                    <a
                      href="https://wa.me/919876543210"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#25D366] text-white hover:opacity-90 transition"
                      aria-label="WhatsApp"
                    >
                      <WhatsAppIcon className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Send Us a Message — card with form */}
            <div className="min-w-0">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8">
                <h2 className="text-xl font-bold text-brand-navy sm:text-2xl">
                  Send Us a Message
                </h2>
                {submitted && (
                  <div className="mt-4">
                    <Notification
                      title="Message sent"
                      message="We'll get back to you soon."
                      type="success"
                      onDismiss={() => setSubmitted(false)}
                    />
                  </div>
                )}
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700">
                        Full Name *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        placeholder="Your name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700">
                        Email *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        placeholder="your@email.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700">
                      Contact Number *
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-university" className="block text-sm font-medium text-gray-700">
                      University *
                    </label>
                    <select
                      id="contact-university"
                      required
                      value={form.university}
                      onChange={(e) => setForm({ ...form, university: e.target.value })}
                      className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    >
                      <option value="">Select University</option>
                      {UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-semester" className="block text-sm font-medium text-gray-700">
                        Semester *
                      </label>
                      <select
                        id="contact-semester"
                        required
                        value={form.semester}
                        onChange={(e) => setForm({ ...form, semester: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                      >
                        <option value="">Select Semester</option>
                        {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="contact-course" className="block text-sm font-medium text-gray-700">
                        Course *
                      </label>
                      <select
                        id="contact-course"
                        required
                        value={form.course}
                        onChange={(e) => setForm({ ...form, course: e.target.value, stream: '' })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                      >
                        <option value="">Select Course</option>
                        {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  {(form.course === 'B.Tech' || form.course === 'Diploma') && (
                    <div>
                      <label htmlFor="contact-stream" className="block text-sm font-medium text-gray-700">
                        Stream *
                      </label>
                      <select
                        id="contact-stream"
                        required
                        value={form.stream}
                        onChange={(e) => setForm({ ...form, stream: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                      >
                        <option value="">Select Stream</option>
                        {STREAMS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700">
                      Message *
                    </label>
                    <textarea
                      id="contact-message"
                      required
                      rows={4}
                      placeholder="How can we help you?"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent resize-none"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 transition disabled:opacity-70"
                  >
                    {loading ? 'Sending...' : 'Send Message'}
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
