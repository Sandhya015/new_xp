import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, Send, Linkedin, Instagram, Facebook, Youtube } from 'lucide-react'
import { Notification } from '@/components/Notification'

const UNIVERSITIES = [
  'BEU — Bihar Engineering University', 'SBTE — State Board of Technical Education', 'JUT — Jharkhand University of Technology',
  'AKTU — Dr. A.P.J. Abdul Kalam Technical Univ.', 'Patna University', 'Patliputra University', 'Munger University',
  'Lalit Narayan Mithila University', 'Veer Kunwar Singh University', 'Tilka Majhi Bhagalpur University',
  'Bhupendra Narayan Mandal University', 'Jai Prakash University', 'Magadh University', 'Purnea University',
  'Nalanda Open University', 'Babasaheb Bhimrao Ambedkar Bihar University',
]
const COURSES = ['B.Tech', 'Diploma', 'BA', 'BSc', 'BCom', 'BBA', 'BCA']
const STREAMS = ['CSE', 'Civil', 'Electrical', 'ECE', 'Mechanical', 'IT']
const QUERY_FOR_OPTIONS = ['Training', 'Internship', 'Certificate', 'General']

export function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    university: '',
    semester: '',
    course: '',
    stream: '',
    queryFor: '',
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
                    <label htmlFor="contact-query" className="block text-sm font-medium text-gray-700">
                      Query For *
                    </label>
                    <select
                      id="contact-query"
                      required
                      value={form.queryFor}
                      onChange={(e) => setForm({ ...form, queryFor: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    >
                      <option value="">Select</option>
                      {QUERY_FOR_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                    </select>
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
