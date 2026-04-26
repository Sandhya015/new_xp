import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { BarChart3, Brain, Code2, Cpu, Filter, Loader2, Megaphone, Search, Smartphone, X } from 'lucide-react'
import { courseService } from '@/services/courseService'
import { enrollmentService } from '@/services/enrollmentService'
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout'
import { useAuth } from '@/hooks/useAuth'
import { courseContentPath, courseMarketingPath } from '@/utils/courseStudyLink'
import { courseListingBlurb } from '@/utils/sanitizeHtml'
import {
  catalogCourseMatchesFilters,
  CATALOG_FILTER_ALL as ALL,
  type CatalogCategoryFilter,
  type CatalogModeFilter,
} from '@/components/training/trainingCatalogFilters'
import { TrainingFiltersControls } from '@/components/training/TrainingFiltersControls'

type Mode = 'Online' | 'Offline' | 'Hybrid'

type CourseCard = {
  id: string
  title: string
  description: string
  category: 'technical' | 'non-technical' | 'other'
  duration: string
  mode: Mode
  universities: string
  price: number
  Icon: LucideIcon
  tag: string
  trainingTags: string[]
  courses: string[]
  streams: string[]
  subjects: string[]
}

const ICON_MAP: LucideIcon[] = [Code2, Cpu, Brain, Megaphone, Smartphone, BarChart3]

function courseFromApi(
  c: {
    id: string
    title: string
    description: string
    shortDescription?: string
    category: string
    duration: string
    mode: string
    universities: string
    price: number
    tag?: string
    trainingTags?: string[]
    courses?: string[]
    streams?: string[]
    subjects?: string[]
  },
  i: number,
): CourseCard {
  const catRaw = String(c.category || 'technical').toLowerCase()
  const category: CourseCard['category'] =
    catRaw === 'non-technical' ? 'non-technical' : catRaw === 'other' ? 'other' : 'technical'
  const mode: Mode = ['Online', 'Offline', 'Hybrid'].includes(c.mode) ? (c.mode as Mode) : 'Online'
  const tags = Array.isArray(c.trainingTags) ? c.trainingTags : []
  const courses = Array.isArray(c.courses) ? c.courses : []
  const streams = Array.isArray(c.streams) ? c.streams : []
  const subjects = Array.isArray(c.subjects) ? c.subjects : []
  return {
    id: c.id,
    title: c.title,
    description: courseListingBlurb(c.shortDescription, c.description),
    category,
    duration: c.duration || '—',
    mode,
    universities: c.universities || '—',
    price: typeof c.price === 'number' ? c.price : 0,
    Icon: ICON_MAP[i % ICON_MAP.length],
    tag: String(c.tag || '').trim(),
    trainingTags: tags,
    courses,
    streams,
    subjects,
  }
}

export function StudentTraining() {
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState<CatalogCategoryFilter>(ALL)
  const [university, setUniversity] = useState(ALL)
  const [courseLevel, setCourseLevel] = useState(ALL)
  const [branchVal, setBranchVal] = useState(ALL)
  const [branchOther, setBranchOther] = useState('')
  const [durType, setDurType] = useState<'' | 'hours' | 'weeks'>('')
  const [durVal, setDurVal] = useState(ALL)
  const [mode, setMode] = useState<CatalogModeFilter>(ALL)
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false)

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
          shortDescription?: string
          category: string
          duration: string
          mode: string
          universities: string
          price: number
          tag?: string
          trainingTags?: string[]
          courses?: string[]
          streams?: string[]
          subjects?: string[]
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

  const catalogFilters = useMemo(
    () => ({
      search: searchQuery,
      category,
      university,
      courseLevel,
      branchVal,
      branchOther,
      durType,
      durVal,
      mode,
    }),
    [searchQuery, category, university, courseLevel, branchVal, branchOther, durType, durVal, mode],
  )

  const filtered = useMemo(
    () => courses.filter((c) => catalogCourseMatchesFilters(c, catalogFilters)),
    [courses, catalogFilters],
  )

  const clearFilters = () => {
    setSearchQuery('')
    setCategory(ALL)
    setUniversity(ALL)
    setCourseLevel(ALL)
    setBranchVal(ALL)
    setBranchOther('')
    setDurType('')
    setDurVal(ALL)
    setMode(ALL)
  }

  const filterControls = (
    <TrainingFiltersControls
      category={category}
      setCategory={setCategory}
      university={university}
      setUniversity={setUniversity}
      courseLevel={courseLevel}
      setCourseLevel={setCourseLevel}
      branchVal={branchVal}
      setBranchVal={setBranchVal}
      branchOther={branchOther}
      setBranchOther={setBranchOther}
      durType={durType}
      setDurType={setDurType}
      durVal={durVal}
      setDurVal={setDurVal}
      mode={mode}
      setMode={setMode}
    />
  )

  return (
    <div className="space-y-6 w-full min-w-0">
      {payError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex justify-between gap-4">
          <span>{payError}</span>
          <button type="button" className="shrink-0 font-medium underline" onClick={clearPayError}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="relative flex flex-1 overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search as you type — program, topic, or university…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border-0 bg-transparent pl-10 pr-10 py-2.5 text-sm outline-none focus:outline-none focus:ring-0 placeholder:text-gray-500"
            />
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setFiltersSheetOpen(true)
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:hidden"
          >
            <Filter className="h-4 w-4" /> Filters
          </button>
        </div>

        <div className="hidden lg:block rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {filterControls}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-brand-navy">{filtered.length}</span> program{filtered.length === 1 ? '' : 's'}
            </p>
            <button type="button" onClick={clearFilters} className="text-sm font-semibold text-brand-accent hover:underline">
              Clear all filters
            </button>
          </div>
        </div>
      </div>

      {filtersSheetOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/40 sm:justify-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="student-training-filters-title"
            >
              <button
                type="button"
                className="absolute inset-0 cursor-default border-0 bg-transparent"
                aria-label="Close filters"
                onClick={() => setFiltersSheetOpen(false)}
              />
              <div className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-6 shadow-xl sm:mx-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <p id="student-training-filters-title" className="text-lg font-semibold text-brand-navy">
                    Filters
                  </p>
                  <button
                    type="button"
                    onClick={() => setFiltersSheetOpen(false)}
                    className="rounded-lg p-2 hover:bg-gray-100"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {filterControls}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold"
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersSheetOpen(false)}
                    className="flex-1 rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-white"
                  >
                    Show {filtered.length} results
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-gray">
          <Loader2 className="h-6 w-6 animate-spin text-brand-accent" />
          <span>Loading programs…</span>
        </div>
      ) : loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</p>
      ) : filtered.length === 0 ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-slate-gray">
            {courses.length === 0
              ? 'No training programs are available yet.'
              : 'No programs match your search or filters.'}
          </p>
          {courses.length > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-gray-50 sm:w-auto"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const isEnrolled = Boolean(token && enrolledCourseIds.has(c.id))
            const isCompleted = Boolean(token && completedCourseIds.has(c.id))
            const detailTo = isEnrolled ? courseContentPath(c.id) : courseMarketingPath(c.id)
            return (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      c.category === 'technical' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                    }`}
                  >
                    <c.Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      c.category === 'technical' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {c.category === 'technical' ? 'Technical' : c.category === 'non-technical' ? 'Non-technical' : 'Other'}
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
