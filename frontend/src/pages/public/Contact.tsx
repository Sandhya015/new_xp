import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, Send, Linkedin, Instagram, Facebook, Youtube } from 'lucide-react'
import { Notification } from '@/components/Notification'

export function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    university: '',
    message: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: POST /api/contact when backend is ready
    setSubmitted(true)
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
                    <a href="mailto:support@xpertintern.com" className="mt-0.5 block text-slate-gray hover:text-brand-accent transition">
                      support@xpertintern.com
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700">
                        Phone
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        placeholder="+91 XXXXXXXXXX"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-university" className="block text-sm font-medium text-gray-700">
                        University
                      </label>
                      <input
                        id="contact-university"
                        type="text"
                        placeholder="Your university name"
                        value={form.university}
                        onChange={(e) => setForm({ ...form, university: e.target.value })}
                        className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                      />
                    </div>
                  </div>
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
                  <button
                    type="submit"
                    className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 transition"
                  >
                    Send Message
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
