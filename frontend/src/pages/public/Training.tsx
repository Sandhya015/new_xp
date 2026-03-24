import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout'
import { courseService } from '@/services/courseService'
import {
  Search,
  Filter,
  ChevronDown,
  Clock,
  Monitor,
  Building2,
  Laptop,
  Code2,
  Cpu,
  Brain,
  Megaphone,
  Smartphone,
  BarChart3,
  X,
  ArrowRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { UNIVERSITIES_LIST } from '@/constants/universities'

const BRANCHES = [
  'Computer Science',
  'IT',
  'Electrical',
  'Electronics',
  'Mechanical',
  'Civil',
  'BA / BSc / BCom',
  'BBA / BCA',
] as const

const UNIVERSITIES_FILTER = [
  'BEU',
  'SBTE',
  'JUT',
  'AKTU',
  'Patna University',
  'Magadh University',
  'Others',
] as const

type Category = 'all' | 'technical' | 'non-technical'
type Mode = 'Online' | 'Offline' | 'Hybrid'

const DURATION_WEEKS = [2, 4, 6, 8, 12, 24] as const
const DURATION_HOURS = [60, 80, 100, 120] as const
const MODES: Mode[] = ['Online', 'Offline', 'Hybrid']

interface Course {
  id: string
  title: string
  description: string
  category: 'technical' | 'non-technical'
  duration: string
  mode: Mode
  universities: string
  price: number
  tagColor: string
  iconBg: string
  Icon: LucideIcon
}

const ICON_MAP: LucideIcon[] = [Code2, Cpu, Brain, Megaphone, Smartphone, BarChart3]
function courseFromApi(c: { id: string; title: string; description: string; category: string; duration: string; mode: string; universities: string; price: number }, i: number): Course {
  const isTech = (c.category || 'technical') === 'technical'
  const mode: Mode = ['Online', 'Offline', 'Hybrid'].includes(c.mode) ? c.mode as Mode : 'Online'
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    category: isTech ? 'technical' : 'non-technical',
    duration: c.duration,
    mode,
    universities: c.universities,
    price: c.price,
    tagColor: isTech ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
    iconBg: isTech ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600',
    Icon: ICON_MAP[i % ICON_MAP.length],
  }
}

function ModeIcon({ mode }: { mode: Mode }) {
  if (mode === 'Online') return <Laptop className="h-4 w-4 shrink-0 text-slate-500" />
  if (mode === 'Offline') return <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
  return <Monitor className="h-4 w-4 shrink-0 text-slate-500" />
}

export function Training() {
  const [courses, setCourses] = useState<Course[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [branches, setBranches] = useState<Set<string>>(new Set())
  const [universities, setUniversities] = useState<Set<string>>(new Set())
  const [durationWeeks, setDurationWeeks] = useState<Set<number>>(new Set())
  const [durationHours, setDurationHours] = useState<Set<number>>(new Set())
  const [modes, setModes] = useState<Set<Mode>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [enrollCourse, setEnrollCourse] = useState<Course | null>(null)
  const [enrollForm, setEnrollForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    university: '',
    branch: '',
    semester: '1st',
    address: '',
  })
  const { user } = useAuth()
  const { startCheckout, busy: payBusy, error: payError, clearError: clearPayError } = useRazorpayCheckout()

  useEffect(() => {
    if (!enrollCourse || !user) return
    setEnrollForm((f) => ({
      ...f,
      fullName: f.fullName || user.name || '',
      email: f.email || user.email || '',
    }))
  }, [enrollCourse, user])

  const toggleBranch = (b: string) => {
    setBranches((prev) => {
      const next = new Set(prev)
      if (next.has(b)) next.delete(b)
      else next.add(b)
      return next
    })
  }

  const toggleUniversity = (u: string) => {
    setUniversities((prev) => {
      const next = new Set(prev)
      if (next.has(u)) next.delete(u)
      else next.add(u)
      return next
    })
  }

  const toggleDurationWeeks = (w: number) => {
    setDurationWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(w)) next.delete(w)
      else next.add(w)
      return next
    })
  }

  const toggleDurationHours = (h: number) => {
    setDurationHours((prev) => {
      const next = new Set(prev)
      if (next.has(h)) next.delete(h)
      else next.add(h)
      return next
    })
  }

  const toggleMode = (m: Mode) => {
    setModes((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    courseService.list({ limit: 50 })
      .then((res) => {
        if (!cancelled && res.items)
          setCourses((res.items as Array<{ id: string; title: string; description: string; category: string; duration: string; mode: string; universities: string; price: number }>).map((c, i) => courseFromApi(c, i)))
      })
      .finally(() => { if (!cancelled) setCoursesLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch =
        !search ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase())
      const matchCategory =
        category === 'all' ||
        (category === 'technical' && c.category === 'technical') ||
        (category === 'non-technical' && c.category === 'non-technical')
      const weeksMatch = c.duration.match(/^(\d+)\s*Weeks?$/i)
      const hoursMatch = c.duration.match(/^(\d+)\s*Hours?$/i)
      const courseWeeks = weeksMatch ? parseInt(weeksMatch[1], 10) : null
      const courseHours = hoursMatch ? parseInt(hoursMatch[1], 10) : null
      const matchDuration =
        (durationWeeks.size === 0 && durationHours.size === 0) ||
        (courseWeeks !== null && durationWeeks.has(courseWeeks)) ||
        (courseHours !== null && durationHours.has(courseHours))
      const matchMode =
        modes.size === 0 || modes.has(c.mode)
      return matchSearch && matchCategory && matchDuration && matchMode
    })
  }, [courses, search, category, durationWeeks, durationHours, modes])

  return (
    <div className="min-h-screen bg-gray-50/50 min-w-0">
      {/* Blue hero section */}
      <section className="bg-gradient-to-br from-brand-navy via-primary-800 to-primary-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14 sm:px-6 lg:px-8 lg:py-16">
          <nav className="text-sm text-primary-200" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white transition">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-white font-medium">Trainings</span>
          </nav>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Explore Training Programs
          </h1>
          <p className="mt-3 max-w-2xl text-base text-primary-200 sm:text-lg">
            Find the perfect training aligned with your university, branch and career goals.
          </p>
        </div>
      </section>

      {/* Search + Filter bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search trainings (e.g. Web Development, Python)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition shrink-0 lg:hidden"
            >
              <Filter className="h-4 w-4" /> Filter
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex gap-6 lg:gap-8">
        {/* Left sidebar - Filters */}
        <aside
          className={`${
            filtersOpen ? 'fixed inset-0 z-40 lg:relative lg:inset-auto' : 'hidden lg:block'
          } lg:w-64 xl:w-72 shrink-0`}
        >
          {filtersOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-30 lg:hidden"
              onClick={() => setFiltersOpen(false)}
              aria-hidden
            />
          )}
          <div className="relative w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between lg:justify-start">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex items-center gap-2 text-sm font-semibold text-brand-navy"
              >
                Filters
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="lg:hidden p-1 rounded hover:bg-gray-100"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {sidebarOpen && (
              <div className="mt-4 space-y-6">
                {/* Category */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Category
                  </p>
                  <div className="space-y-2">
                    {(['all', 'technical', 'non-technical'] as const).map((c) => (
                      <label key={c} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="category"
                          checked={category === c}
                          onChange={() => setCategory(c)}
                          className="h-4 w-4 border-gray-300 text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {c === 'all' ? 'All' : c.replace('-', ' ')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Branch / Stream */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Branch / Stream
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {BRANCHES.map((b) => (
                      <label key={b} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={branches.has(b)}
                          onChange={() => toggleBranch(b)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-sm text-gray-700">{b}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Duration (Weeks) */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Duration (Weeks)
                  </p>
                  <div className="space-y-2">
                    {DURATION_WEEKS.map((w) => (
                      <label key={w} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={durationWeeks.has(w)}
                          onChange={() => toggleDurationWeeks(w)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-sm text-gray-700">{w} Weeks</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Duration (Hours) */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Duration (Hours)
                  </p>
                  <div className="space-y-2">
                    {DURATION_HOURS.map((h) => (
                      <label key={h} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={durationHours.has(h)}
                          onChange={() => toggleDurationHours(h)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-sm text-gray-700">{h} Hours</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Mode */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Mode
                  </p>
                  <div className="space-y-2">
                    {MODES.map((m) => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={modes.has(m)}
                          onChange={() => toggleMode(m)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-sm text-gray-700">{m}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* University */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    University
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {UNIVERSITIES_FILTER.map((u) => (
                      <label key={u} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={universities.has(u)}
                          onChange={() => toggleUniversity(u)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-sm text-gray-700">{u}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Course grid */}
        <div className="flex-1 min-w-0">
          {coursesLoading && <p className="text-sm text-slate-gray py-4">Loading courses...</p>}
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => {
              const CourseIcon = course.Icon
              return (
                <article
                  key={course.id}
                  className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition min-w-0"
                >
                  <div className="p-4 sm:p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${course.iconBg}`}
                      >
                        <CourseIcon className="h-6 w-6" />
                      </div>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-xs font-medium ${course.tagColor}`}
                      >
                        {course.category === 'technical' ? 'Technical' : 'Non-Technical'}
                      </span>
                    </div>
                    <h2 className="mt-3 text-base font-bold text-brand-navy sm:text-lg line-clamp-2">
                      {course.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-gray line-clamp-2">{course.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 shrink-0" /> {course.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <ModeIcon mode={course.mode} /> {course.mode}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 shrink-0" /> {course.universities}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-brand-navy">
                      ₹{course.price.toLocaleString('en-IN')} / course
                    </p>
                  </div>
                  <div className="border-t border-gray-100 p-4 sm:p-5 pt-0">
                    <button
                      type="button"
                      onClick={() => setEnrollCourse(course)}
                      className="flex w-full items-center justify-center rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition"
                    >
                      Enroll Now
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          {filteredCourses.length === 0 && (
            <p className="text-center py-12 text-slate-gray">No courses match your filters.</p>
          )}
        </div>
      </div>

      {/* Enroll modal */}
      {enrollCourse && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setEnrollCourse(null)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div
              className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 className="text-lg font-bold text-brand-navy">Enroll: {enrollCourse.title}</h2>
                <button
                  type="button"
                  onClick={() => setEnrollCourse(null)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form
                className="p-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!enrollCourse) return
                  clearPayError()
                  void startCheckout({
                    courseId: enrollCourse.id,
                    courseTitle: enrollCourse.title,
                    price: enrollCourse.price,
                    prefill: {
                      name: enrollForm.fullName,
                      email: enrollForm.email,
                      contact: enrollForm.mobile.replace(/\D/g, '').slice(-10),
                    },
                    onSuccess: () => setEnrollCourse(null),
                  })
                }}
              >
                {/* Two-column row: Full Name, Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="enroll-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      id="enroll-name"
                      type="text"
                      placeholder="Full name"
                      value={enrollForm.fullName}
                      onChange={(e) => setEnrollForm((f) => ({ ...f, fullName: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="enroll-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      id="enroll-email"
                      type="email"
                      placeholder="Email"
                      value={enrollForm.email}
                      onChange={(e) => setEnrollForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                </div>
                {/* Two-column row: Mobile, University */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="enroll-mobile" className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                    <input
                      id="enroll-mobile"
                      type="tel"
                      placeholder="+91"
                      value={enrollForm.mobile}
                      onChange={(e) => setEnrollForm((f) => ({ ...f, mobile: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="enroll-university" className="block text-sm font-medium text-gray-700 mb-1">University</label>
                    <select
                      id="enroll-university"
                      value={enrollForm.university}
                      onChange={(e) => setEnrollForm((f) => ({ ...f, university: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    >
                      <option value="">Select</option>
                      {UNIVERSITIES_LIST.map((u) => (
                        <option key={u.name} value={u.name}>{u.shortForm} — {u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Two-column row: Branch / Stream, Semester */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="enroll-branch" className="block text-sm font-medium text-gray-700 mb-1">Branch / Stream</label>
                    <input
                      id="enroll-branch"
                      type="text"
                      placeholder="Branch"
                      value={enrollForm.branch}
                      onChange={(e) => setEnrollForm((f) => ({ ...f, branch: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="enroll-semester" className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <select
                      id="enroll-semester"
                      value={enrollForm.semester}
                      onChange={(e) => setEnrollForm((f) => ({ ...f, semester: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    >
                      {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Full width: Address */}
                <div>
                  <label htmlFor="enroll-address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    id="enroll-address"
                    rows={3}
                    placeholder="Address"
                    value={enrollForm.address}
                    onChange={(e) => setEnrollForm((f) => ({ ...f, address: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent resize-none"
                  />
                </div>
                <p className="rounded-lg bg-primary-50 px-3 py-2 text-xs text-brand-navy">
                  {enrollCourse.price > 0
                    ? 'You will pay securely via Razorpay (UPI, card, netbanking). Price is taken from the course — not editable here.'
                    : 'This course is free — we will enroll you without payment.'}
                </p>
                {payError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                    {payError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={payBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition disabled:opacity-60"
                >
                  {payBusy ? 'Please wait…' : enrollCourse.price > 0 ? (
                    <>Proceed to payment <ArrowRight className="h-4 w-4" /></>
                  ) : (
                    <>Enroll free <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
