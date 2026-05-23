import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout'
import { courseService } from '@/services/courseService'
import { enrollmentService } from '@/services/enrollmentService'
import { Search, Filter, X, Loader2 } from 'lucide-react'
import { courseListingBlurb } from '@/utils/sanitizeHtml'
import { TrainingProgramCard } from '@/components/training/TrainingProgramCard'
import { TrainingEnrollmentModal, type EnrollCourseLite } from '@/components/training/TrainingEnrollmentModal'
import {
  catalogCourseMatchesFilters,
  CATALOG_FILTER_ALL as ALL,
  type CatalogCategoryFilter,
  type CatalogModeFilter,
} from '@/components/training/trainingCatalogFilters'
import { TrainingFiltersControls } from '@/components/training/TrainingFiltersControls'

interface Course {
  id: string
  title: string
  description: string
  category: 'technical' | 'non-technical' | 'other'
  duration: string
  mode: string
  universities: string
  tag: string
  price: number
  originalPrice: number
  featuredImageUrl: string
  trainingTags: string[]
  courses: string[]
  streams: string[]
  subjects: string[]
  reviewAverage?: number
  reviewCount?: number
}

function courseFromApi(c: Record<string, unknown>): Course {
  const catRaw = String(c.category || 'technical').toLowerCase()
  const category: Course['category'] =
    catRaw === 'non-technical' ? 'non-technical' : catRaw === 'other' ? 'other' : 'technical'
  const mode = String(c.mode || 'Online')
  const tags = Array.isArray(c.trainingTags) ? (c.trainingTags as string[]) : []
  const courses = Array.isArray(c.courses) ? (c.courses as string[]) : []
  const streams = Array.isArray(c.streams) ? (c.streams as string[]) : []
  const subjects = Array.isArray(c.subjects) ? (c.subjects as string[]) : []
  return {
    id: String(c.id || ''),
    title: String(c.title || ''),
    description: courseListingBlurb(String(c.shortDescription || ''), String(c.description || '')),
    category,
    duration: String(c.duration || ''),
    mode,
    universities: String(c.universities || ''),
    tag: String(c.tag || '').trim(),
    price: Number(c.price) || 0,
    originalPrice: Number(c.originalPrice) || 0,
    featuredImageUrl: String(c.featuredImageUrl || ''),
    trainingTags: tags,
    courses,
    streams,
    subjects,
    reviewAverage: typeof c.reviewAverage === 'number' ? c.reviewAverage : undefined,
    reviewCount: typeof c.reviewCount === 'number' ? c.reviewCount : undefined,
  }
}

export function Training() {
  const location = useLocation()
  const [courses, setCourses] = useState<Course[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesLoadError, setCoursesLoadError] = useState<string | null>(null)
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
  const [enrollCourse, setEnrollCourse] = useState<Course | null>(null)
  const { token } = useAuth()
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set())
  const [completedCourseIds, setCompletedCourseIds] = useState<Set<string>>(new Set())

  const {
    startCheckout,
    busy: payBusy,
    error: payError,
    clearError: clearPayError,
    abandonCheckout,
  } = useRazorpayCheckout()

  useEffect(() => {
    if (!token) {
      setEnrolledCourseIds(new Set())
      setCompletedCourseIds(new Set())
      return
    }
    const path = location.pathname.replace(/\/$/, '')
    if (path !== '/training') return
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
    setCoursesLoadError(null)
    courseService
      .list({ limit: 200 })
      .then((res) => {
        if (cancelled) return
        const items = Array.isArray(res.items) ? res.items : []
        setCourses(items.map((c) => courseFromApi(c as Record<string, unknown>)))
      })
      .catch(() => {
        if (!cancelled) {
          setCourses([])
          setCoursesLoadError('Could not load trainings. Check your connection or try again in a moment.')
        }
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false)
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

  const filteredCourses = useMemo(
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

  const enrollLite = (c: Course | null): EnrollCourseLite | null =>
    c
      ? {
          id: c.id,
          title: c.title,
          price: c.price,
          universities: c.universities,
          mode: c.mode,
          duration: c.duration,
          featuredImageUrl: c.featuredImageUrl,
          shortDescription: c.description,
        }
      : null

  return (
    <div className="min-h-screen bg-gray-50/50 min-w-0">
      <section className="bg-gradient-to-br from-brand-navy via-primary-800 to-primary-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14 sm:px-6 lg:px-8 lg:py-16">
          <nav className="text-sm text-primary-200" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white transition">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white font-medium">Trainings</span>
          </nav>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Explore Training Programs</h1>
          <p className="mt-3 max-w-2xl text-base text-primary-200 sm:text-lg">
            Find the perfect training aligned with your university, branch and career goals.
          </p>
        </div>
      </section>

      <div className="sticky top-14 z-30 border-b border-gray-200 bg-white shadow-sm sm:top-16">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex w-full flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-1 items-center gap-2 pl-3 pr-1 min-w-0">
                <Search className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                <input
                  type="search"
                  placeholder="Search as you type — course, skill, or university…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className="min-w-0 flex-1 border-0 bg-transparent py-3 pr-1 text-sm placeholder:text-gray-500 outline-none focus:outline-none focus:ring-0"
                />
                {searchQuery.trim() ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFiltersSheetOpen(true)
              }}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-brand-navy lg:hidden"
            >
              <Filter className="h-4 w-4 shrink-0" aria-hidden /> Filters
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="hidden lg:block rounded-xl border border-gray-200 bg-white p-4 shadow-sm mb-6">
          {filterControls}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-brand-navy">{filteredCourses.length}</span> program
              {filteredCourses.length === 1 ? '' : 's'}
            </p>
            <button type="button" onClick={clearFilters} className="text-sm font-semibold text-brand-accent hover:underline">
              Clear all filters
            </button>
          </div>
        </div>

        {filtersSheetOpen && typeof document !== 'undefined'
          ? createPortal(
              <div
                className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/40 sm:justify-center sm:p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="training-filters-title"
              >
                <button
                  type="button"
                  className="absolute inset-0 cursor-default border-0 bg-transparent"
                  aria-label="Close filters"
                  onClick={() => setFiltersSheetOpen(false)}
                />
                <div className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-6 shadow-xl sm:mx-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <p id="training-filters-title" className="font-bold text-brand-navy">
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
                      Show {filteredCourses.length} results
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        {coursesLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-gray" role="status" aria-live="polite">
            <Loader2 className="h-6 w-6 shrink-0 animate-spin text-brand-accent" aria-hidden />
            <span>Loading programs…</span>
          </div>
        ) : coursesLoadError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{coursesLoadError}</p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course) => {
                const isEnrolled = Boolean(token && enrolledCourseIds.has(course.id))
                const isCompleted = Boolean(token && completedCourseIds.has(course.id))
                return (
                  <TrainingProgramCard
                    key={course.id}
                    course={course}
                    isLoggedIn={Boolean(token)}
                    isEnrolled={isEnrolled}
                    isCompleted={isCompleted}
                    onEnroll={() => setEnrollCourse(course)}
                    payBusy={payBusy}
                  />
                )
              })}
            </div>

            {courses.length === 0 && (
              <p className="text-center py-12 text-slate-gray">
                No trainings are listed yet. If you just added courses in the database, confirm this site uses the same API environment and try a hard refresh.
              </p>
            )}
            {courses.length > 0 && filteredCourses.length === 0 && (
              <div className="py-12 text-center space-y-3">
                <p className="text-slate-gray">No courses match your current search or filters.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-gray-50"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <TrainingEnrollmentModal
        key={enrollCourse ? enrollCourse.id : 'closed'}
        course={enrollLite(enrollCourse)}
        abandonCheckout={abandonCheckout}
        onClose={() => setEnrollCourse(null)}
        startCheckout={startCheckout}
        payBusy={payBusy}
        payError={payError}
        clearPayError={clearPayError}
      />
    </div>
  )
}
