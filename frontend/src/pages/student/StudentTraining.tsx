import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { BarChart3, Brain, Code2, Cpu, Filter, Loader2, Megaphone, Search, Smartphone } from 'lucide-react'
import { courseService } from '@/services/courseService'
import { enrollmentService } from '@/services/enrollmentService'
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout'
import { useAuth } from '@/hooks/useAuth'
import { courseContentPath, courseMarketingPath } from '@/utils/courseStudyLink'

type Mode = 'Online' | 'Offline' | 'Hybrid'

type CourseCard = {
  id: string
  title: string
  description: string
  category: 'technical' | 'non-technical'
  duration: string
  mode: Mode
  universities: string
  price: number
  Icon: LucideIcon
}

const ICON_MAP: LucideIcon[] = [Code2, Cpu, Brain, Megaphone, Smartphone, BarChart3]

function courseFromApi(
  c: {
    id: string
    title: string
    description: string
    category: string
    duration: string
    mode: string
    universities: string
    price: number
  },
  i: number
): CourseCard {
  const isTech = (c.category || 'technical') === 'technical'
  const mode: Mode = ['Online', 'Offline', 'Hybrid'].includes(c.mode) ? (c.mode as Mode) : 'Online'
  return {
    id: c.id,
    title: c.title,
    description: c.description || '',
    category: isTech ? 'technical' : 'non-technical',
    duration: c.duration || '—',
    mode,
    universities: c.universities || '—',
    price: typeof c.price === 'number' ? c.price : 0,
    Icon: ICON_MAP[i % ICON_MAP.length],
  }
}

export function StudentTraining() {
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [courses, setCourses] = useState<CourseCard[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { user, token } = useAuth()
  const { startCheckout, busy: payBusy, checkoutCourseId, error: payError, clearError: clearPayError } =
    useRazorpayCheckout()
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set())
  const [completedCourseIds, setCompletedCourseIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!token) {
      setEnrolledCourseIds(new Set())
      setCompletedCourseIds(new Set())
      return
    }
    const path = location.pathname.replace(/\/$/, '')
    if (path !== '/dashboard/training') {
      return
    }
    let cancelled = false
    enrollmentService
      .list()
      .then((res) => {
        if (cancelled) return
        const enrolled = new Set<string>()
        const completed = new Set<string>()
        for (const i of res.items || []) {
          if (i.courseId) enrolled.add(i.courseId)
          if (i.courseId && i.certificateIssued) completed.add(i.courseId)
        }
        setEnrolledCourseIds(enrolled)
        setCompletedCourseIds(completed)
      })
      .catch(() => {
        if (!cancelled) {
          setEnrolledCourseIds(new Set())
          setCompletedCourseIds(new Set())
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, location.pathname, location.key])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    courseService
      .list({ limit: 200 })
      .then((res) => {
        if (cancelled) return
        const items = (res.items || []) as Array<{
          id: string
          title: string
          description: string
          category: string
          duration: string
          mode: string
          universities: string
          price: number
        }>
        setCourses(items.map((c, i) => courseFromApi(c, i)))
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load programs. Check your connection and try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return courses
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.universities.toLowerCase().includes(q)
    )
  }, [courses, search])

  return (
    <div className="space-y-6 w-full">
      {payError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex justify-between gap-4">
          <span>{payError}</span>
          <button type="button" className="shrink-0 font-medium underline" onClick={clearPayError}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search by program name, topic, or university…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          aria-disabled
          title="More filters can be added later"
        >
          <Filter className="h-4 w-4" /> Filters
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-gray">
          <Loader2 className="h-6 w-6 animate-spin text-brand-accent" />
          <span>Loading programs…</span>
        </div>
      ) : loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-slate-gray">
          {courses.length === 0
            ? 'No training programs are available yet.'
            : 'No programs match your search.'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const isEnrolled = Boolean(token && enrolledCourseIds.has(c.id))
            const isCompleted = Boolean(token && completedCourseIds.has(c.id))
            const detailTo = isEnrolled ? courseContentPath(c.id) : courseMarketingPath(c.id)
            return (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.category === 'technical' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                  <c.Icon className="h-5 w-5" />
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${c.category === 'technical' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
                >
                  {c.category === 'technical' ? 'Technical' : 'Non-technical'}
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-brand-navy line-clamp-2">{c.title}</h3>
              <p className="mt-1 text-xs text-slate-gray line-clamp-2">{c.description}</p>
              <p className="mt-2 text-xs text-slate-gray">
                {c.universities} · {c.duration} · {c.mode}
              </p>
              <p className="mt-2 text-sm font-semibold text-brand-navy">
                {c.price > 0 ? `₹${c.price.toLocaleString('en-IN')}` : 'Free'}
              </p>
              <div className="mt-4 flex gap-2 mt-auto">
                <Link
                  to={detailTo}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {isEnrolled ? 'View course' : 'View details'}
                </Link>
                {isEnrolled ? (
                  <span
                    className={`flex-1 rounded-lg border py-2 text-center text-sm font-semibold ${
                      isCompleted
                        ? 'border-violet-200 bg-violet-50 text-violet-900'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {isCompleted ? 'Completed' : 'Enrolled'}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={!token || (payBusy && checkoutCourseId === c.id)}
                    onClick={() =>
                      startCheckout({
                        courseId: c.id,
                        courseTitle: c.title,
                        price: c.price,
                        prefill: {
                          name: user?.name,
                          email: user?.email,
                          contact: user?.mobile,
                        },
                      })
                    }
                    className="flex-1 rounded-lg bg-brand-accent py-2 text-center text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                  >
                    {payBusy && checkoutCourseId === c.id ? 'Please wait…' : 'Enroll Now'}
                  </button>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
