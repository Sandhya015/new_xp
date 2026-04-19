import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { courseService } from '@/services/courseService'
import { enrollmentService } from '@/services/enrollmentService'
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout'
import { useAuth } from '@/hooks/useAuth'
import { courseContentPath } from '@/utils/courseStudyLink'
import {
  Loader2,
  Lock,
  ChevronDown,
  ChevronRight,
  Clock,
  Users,
  BookOpen,
  Star,
  Heart,
  Share2,
  Play,
  ClipboardList,
  FileText,
  FlaskConical,
  Mic2,
  BarChart3,
  RefreshCw,
  Check,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { plainTextFromHtml, sanitizeRichHtml } from '@/utils/sanitizeHtml'
import { absoluteApiUrl } from '@/config/api'
import { getYoutubeEmbedUrl, getYoutubeWatchUrl } from '@/utils/youtubeEmbed'

type PublicTopic = {
  id: string
  title: string
  type: string
  duration: string
  locked?: boolean
}

type PublicModule = {
  id: string
  title: string
  order?: number
  topics: PublicTopic[]
}

type PublicCourse = {
  id: string
  title: string
  description: string
  shortDescription?: string
  fullDescription?: string
  duration: string
  mode: string
  universities: string
  price: number
  originalPrice?: number
  tag?: string
  category?: string
  difficulty?: string
  featuredImageUrl?: string
  introVideoUrl?: string
  trainerName?: string
  whatYouWillLearn?: string[]
  targetAudience?: string
  materialsIncluded?: string[]
  instructions?: string
  trainingTags?: string[]
  marketingCategories?: string[]
  authorName?: string
  curriculum?: PublicModule[]
  enrollmentCount?: number
  updatedAt?: string | null
  trainingStartDate?: string
  trainingEndDate?: string
  trainingMaxSeats?: number | null
}

function linesFromText(s: string | undefined): string[] {
  if (!s) return []
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function formatTrainingDate(ymd: string): string {
  const raw = (ymd || '').trim()
  if (!raw) return ''
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function difficultyLabel(raw: string | undefined): string {
  const d = (raw || '').trim().toLowerCase()
  if (d === 'all') return 'All Levels'
  return (raw || '').trim() || 'Intermediate'
}

function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })
}

function topicRowIcon(type: string): LucideIcon {
  const t = (type || '').toLowerCase()
  if (t === 'quiz') return ClipboardList
  if (t === 'reading') return FileText
  if (t === 'lab') return FlaskConical
  if (t === 'interview') return Mic2
  if (t === 'recording') return Play
  if (t === 'lecture') return Play
  return BookOpen
}

function parseLearnLine(line: string): { lead: string; rest: string | null } {
  const idx = line.indexOf(':')
  if (idx > 0 && idx < 80) {
    return { lead: line.slice(0, idx).trim(), rest: line.slice(idx + 1).trim() || null }
  }
  return { lead: line, rest: null }
}

export function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const [course, setCourse] = useState<PublicCourse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'info' | 'reviews'>('info')
  const [openModules, setOpenModules] = useState<Set<string>>(() => new Set())
  const [aboutExpanded, setAboutExpanded] = useState(false)
  const [shareHint, setShareHint] = useState<string | null>(null)
  const [userIsEnrolled, setUserIsEnrolled] = useState<boolean | null>(null)
  const { token } = useAuth()
  const { startCheckout, busy, error: payError, clearError } = useRazorpayCheckout()

  useEffect(() => {
    if (!id) return
    let cancelled = false
    courseService
      .getById(id)
      .then((data) => {
        if (!cancelled) setCourse(data as PublicCourse)
      })
      .catch(() => {
        if (!cancelled) setError('Course not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!course?.id) return
    if (!token) {
      setUserIsEnrolled(false)
      return
    }
    let cancelled = false
    setUserIsEnrolled(null)
    enrollmentService
      .getByCourseId(course.id)
      .then(() => {
        if (!cancelled) setUserIsEnrolled(true)
      })
      .catch(() => {
        if (!cancelled) setUserIsEnrolled(false)
      })
    return () => {
      cancelled = true
    }
  }, [course?.id, token])

  const embedUrl = useMemo(() => (course?.introVideoUrl ? getYoutubeEmbedUrl(course.introVideoUrl) : null), [course?.introVideoUrl])
  const youtubeWatchUrl = useMemo(
    () => (course?.introVideoUrl ? getYoutubeWatchUrl(course.introVideoUrl) : null),
    [course?.introVideoUrl],
  )

  const audienceLines = useMemo(() => linesFromText(course?.targetAudience), [course?.targetAudience])

  const instructionLines = useMemo(() => linesFromText(course?.instructions), [course?.instructions])

  const toggleModule = (mid: string) => {
    setOpenModules((prev) => {
      const n = new Set(prev)
      if (n.has(mid)) n.delete(mid)
      else n.add(mid)
      return n
    })
  }

  useEffect(() => {
    if (course?.curriculum?.length) {
      setOpenModules(new Set([course.curriculum[0].id]))
    }
  }, [course?.curriculum])

  const copyShareLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      await navigator.clipboard.writeText(url)
      setShareHint('Link copied')
    } catch {
      setShareHint('Copy link manually')
    }
    setTimeout(() => setShareHint(null), 2500)
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-20 text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin text-brand-accent" />
        Loading course…
      </div>
    )
  }
  if (error || !course) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-red-600">
        {error || 'Not found'}
      </div>
    )
  }

  const displayTag = course.tag || (course.category === 'non-technical' ? 'Non-Technical' : 'Technical')
  const categoryLabel =
    course.marketingCategories && course.marketingCategories.length > 0
      ? course.marketingCategories.join(' · ')
      : displayTag
  const aboutHtml = (course.fullDescription || course.description || '').trim()
  const aboutSafe = sanitizeRichHtml(aboutHtml)
  const aboutPlainLen = plainTextFromHtml(aboutHtml).length
  const aboutClamped = aboutPlainLen > 420 && !aboutExpanded
  const listPrice = course.originalPrice && course.originalPrice > course.price ? course.originalPrice : null
  const enrolled = typeof course.enrollmentCount === 'number' ? course.enrollmentCount : 0
  const instructorName = (course.trainerName || '').trim()
  const initial = instructorName ? instructorName.charAt(0).toUpperCase() : 'E'
  const maxSeats =
    course.trainingMaxSeats != null && Number.isFinite(Number(course.trainingMaxSeats))
      ? Number(course.trainingMaxSeats)
      : null
  const seatsLeft = maxSeats != null && maxSeats > 0 ? Math.max(0, maxSeats - enrolled) : null
  const enrollmentFull = seatsLeft !== null && seatsLeft <= 0 && userIsEnrolled !== true

  const tabBar = (
    <div className="flex gap-8 border-b border-gray-200">
      <button
        type="button"
        onClick={() => setTab('info')}
        className={`relative pb-3 text-sm font-semibold transition ${
          tab === 'info' ? 'text-brand-accent' : 'text-gray-500 hover:text-gray-800'
        }`}
      >
        Course Info
        {tab === 'info' ? <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-accent" /> : null}
      </button>
      <button
        type="button"
        onClick={() => setTab('reviews')}
        className={`relative pb-3 text-sm font-semibold transition ${
          tab === 'reviews' ? 'text-brand-accent' : 'text-gray-500 hover:text-gray-800'
        }`}
      >
        Reviews
        {tab === 'reviews' ? <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-accent" /> : null}
      </button>
    </div>
  )

  const curriculumBlock = (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-gray-900">Course content</h2>
      <p className="mt-1 text-sm text-gray-500">Full lessons unlock after you enroll. Preview the outline below.</p>
      <div className="mt-4 space-y-2">
        {(course.curriculum || []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center text-sm text-gray-600">
            Curriculum will be published soon.
          </p>
        ) : (
          (course.curriculum || []).map((mod, idx) => (
            <div key={mod.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleModule(mod.id)}
                className="flex w-full items-center gap-3 bg-slate-100 px-4 py-3.5 text-left transition hover:bg-slate-200/80"
              >
                {openModules.has(mod.id) ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                )}
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Module {idx + 1}</span>
                <span className="flex-1 text-sm font-semibold text-brand-accent sm:text-base">{mod.title}</span>
              </button>
              {openModules.has(mod.id) ? (
                <ul className="divide-y divide-gray-100 border-t border-gray-100">
                  {(mod.topics || []).map((topic, j) => {
                    const RowIcon = topicRowIcon(topic.type)
                    return (
                      <li
                        key={topic.id || `${mod.id}-${j}`}
                        className="flex items-center gap-3 bg-white px-4 py-3 text-sm text-gray-800"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-brand-accent">
                          <RowIcon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-gray-900">{topic.title}</span>
                          <span className="text-gray-400"> · {topic.type}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 tabular-nums">
                          <span className="text-xs text-gray-500">{topic.duration || '—'}</span>
                          <Lock className="h-4 w-4 text-amber-500" aria-label="Locked until enrolled" />
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  )

  return (
    <div className="min-w-0 bg-slate-100 pb-16">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <nav className="text-xs text-gray-500 sm:text-sm">
            <Link to="/training" className="font-medium text-brand-accent hover:underline">
              Training
            </Link>
            <span className="mx-1.5 text-gray-300">/</span>
            <span className="text-gray-600">{categoryLabel}</span>
          </nav>

          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex gap-0.5 text-amber-400" aria-hidden>
                    {[1, 2, 3, 4, 5].map((k) => (
                      <Star key={k} className="h-5 w-5 fill-none stroke-amber-400 stroke-[1.25]" />
                    ))}
                  </div>
                  <h1 className="mt-2 text-2xl font-bold uppercase tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
                    {course.title}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">{categoryLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:text-sm"
                    title="Wishlist coming soon"
                  >
                    <Heart className="h-4 w-4 text-gray-500" />
                    Wishlist
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyShareLink()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:text-sm"
                  >
                    <Share2 className="h-4 w-4 text-gray-500" />
                    Share
                  </button>
                </div>
              </div>
              {shareHint ? <p className="mt-2 text-xs font-medium text-emerald-600">{shareHint}</p> : null}

              {course.featuredImageUrl ? (
                <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm">
                  <img
                    src={absoluteApiUrl(course.featuredImageUrl)}
                    alt=""
                    className="aspect-[21/9] w-full object-cover sm:aspect-video"
                  />
                </div>
              ) : (
                <div className="mt-6 flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gradient-to-br from-slate-100 to-slate-200 text-gray-400">
                  <BookOpen className="h-14 w-14" strokeWidth={1} />
                </div>
              )}
            </div>

            <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-80 lg:self-start">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md">
                <div className="flex flex-wrap items-baseline gap-2">
                  {course.price > 0 ? (
                    <>
                      <span className="text-2xl font-bold text-gray-900">₹{course.price.toLocaleString('en-IN')}</span>
                      {listPrice ? (
                        <span className="text-sm text-gray-400 line-through">₹{listPrice.toLocaleString('en-IN')}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-2xl font-bold text-emerald-700">Free</span>
                  )}
                </div>

                {payError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                    {payError}
                  </p>
                ) : null}

                {userIsEnrolled === true ? (
                  <div className="mt-4 space-y-2">
                    <Link
                      to={courseContentPath(course.id)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 min-h-[44px]"
                    >
                      View course content
                    </Link>
                    <p className="text-center text-xs font-medium text-emerald-700">You are enrolled in this program.</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy || (Boolean(token) && userIsEnrolled === null) || enrollmentFull}
                    onClick={() => {
                      clearError()
                      void startCheckout({
                        courseId: course.id,
                        courseTitle: course.title,
                        price: course.price,
                      })
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-60 min-h-[44px]"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {enrollmentFull
                      ? 'Fully booked'
                      : Boolean(token) && userIsEnrolled === null
                        ? 'Checking enrollment…'
                        : course.price > 0
                          ? 'Add to cart'
                          : 'Enroll free'}
                  </button>
                )}

                <ul className="mt-5 space-y-3 border-t border-gray-100 pt-5 text-sm text-gray-700">
                  <li className="flex items-start gap-3">
                    <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                    <span>
                      <span className="font-medium text-gray-900">Level</span>
                      <span className="text-gray-600"> · {difficultyLabel(course.difficulty)}</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                    <span>
                      <span className="font-medium text-gray-900">Enrollment</span>
                      <span className="text-gray-600">
                        {' '}
                        · {enrolled} {enrolled === 1 ? 'learner' : 'learners'}
                      </span>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                    <span>
                      <span className="font-medium text-gray-900">Duration</span>
                      <span className="text-gray-600"> · {course.duration || '—'}</span>
                    </span>
                  </li>
                  {course.trainingStartDate?.trim() || course.trainingEndDate?.trim() ? (
                    <li className="flex items-start gap-3">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                      <span>
                        <span className="font-medium text-gray-900">Schedule</span>
                        <span className="text-gray-600">
                          {' '}
                          ·
                          {course.trainingStartDate?.trim()
                            ? ` Starts ${formatTrainingDate(course.trainingStartDate)}`
                            : ''}
                          {course.trainingEndDate?.trim()
                            ? `${course.trainingStartDate?.trim() ? ' ·' : ''} Ends ${formatTrainingDate(course.trainingEndDate)}`
                            : ''}
                        </span>
                      </span>
                    </li>
                  ) : null}
                  {seatsLeft !== null ? (
                    <li className="flex items-start gap-3">
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                      <span>
                        <span className="font-medium text-gray-900">Seats</span>
                        <span className="text-gray-600">
                          {' '}
                          · {seatsLeft} of {maxSeats} available
                        </span>
                      </span>
                    </li>
                  ) : null}
                  <li className="flex items-start gap-3">
                    <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                    <span>
                      <span className="font-medium text-gray-900">Last updated</span>
                      <span className="text-gray-600"> · {formatUpdatedAt(course.updatedAt)}</span>
                    </span>
                  </li>
                </ul>

                <div className="mt-5 border-t border-gray-100 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Instructor</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-accent text-sm font-bold text-white">
                      {initial}
                    </span>
                    <div>
                      <p className="text-xs text-gray-500">A course by</p>
                      <p className="text-sm font-semibold text-gray-900">{instructorName || 'XpertIntern'}</p>
                    </div>
                  </div>
                </div>

                {course.materialsIncluded && course.materialsIncluded.length > 0 ? (
                  <div className="mt-5 border-t border-gray-100 pt-5">
                    <h3 className="text-sm font-bold text-gray-900">What&apos;s included</h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-gray-600">
                      {course.materialsIncluded.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="mt-4 text-xs text-gray-500">
                  {course.mode} · {course.universities}
                </p>

                <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
                  <Link to="/training" className="text-center text-sm font-medium text-brand-accent hover:underline">
                    All trainings
                  </Link>
                  <Link to="/register" className="text-center text-sm font-medium text-gray-600 hover:text-brand-navy">
                    Create account
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          {tab === 'info' ? (
            <div>
              {tabBar}
              <div className="mt-6 space-y-10">
                {embedUrl ? (
                  <div>
                    <div className="aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-black">
                      <iframe
                        title="Course intro"
                        src={embedUrl}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    {youtubeWatchUrl ? (
                      <p className="mt-2 text-sm">
                        <a
                          href={youtubeWatchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-brand-accent hover:underline"
                        >
                          Open on YouTube
                        </a>
                        <span className="text-gray-500"> — opens in a new tab</span>
                      </p>
                    ) : null}
                  </div>
                ) : course.introVideoUrl?.trim() ? (
                  <div className="aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-black">
                    <video
                      controls
                      className="h-full w-full"
                      src={absoluteApiUrl(course.introVideoUrl.trim())}
                    />
                  </div>
                ) : null}

                <section>
                  <h2 className="text-xl font-bold text-gray-900">About this course</h2>
                  {aboutSafe ? (
                    <div className="relative mt-3">
                      <div
                        className={`course-html text-gray-700 leading-relaxed [&_a]:text-brand-accent [&_a]:underline [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_p]:my-2 ${
                          aboutClamped ? 'max-h-52 overflow-hidden' : ''
                        }`}
                        dangerouslySetInnerHTML={{ __html: aboutSafe }}
                      />
                      {aboutClamped ? (
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
                      ) : null}
                      {aboutPlainLen > 420 ? (
                        <button
                          type="button"
                          onClick={() => setAboutExpanded((e) => !e)}
                          className="relative z-[1] mt-2 text-sm font-semibold text-brand-accent hover:underline"
                        >
                          {aboutExpanded ? 'Show less' : '+ Show more'}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">No description yet.</p>
                  )}
                </section>

                {course.whatYouWillLearn && course.whatYouWillLearn.length > 0 ? (
                  <section>
                    <h2 className="text-xl font-bold text-gray-900">What you&apos;ll learn</h2>
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                      {course.whatYouWillLearn.map((line, i) => {
                        const { lead, rest } = parseLearnLine(line)
                        return (
                          <li key={i} className="flex gap-2 text-sm text-gray-700">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                            <span>
                              {rest != null ? (
                                <>
                                  <span className="font-semibold text-gray-900">{lead}:</span> {rest}
                                </>
                              ) : (
                                lead
                              )}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ) : null}

                {audienceLines.length > 0 ? (
                  <section>
                    <h2 className="text-xl font-bold text-gray-900">Requirements</h2>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
                      {audienceLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {instructionLines.length > 0 ? (
                  <section>
                    <h2 className="text-xl font-bold text-gray-900">Instructions</h2>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
                      {instructionLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {course.materialsIncluded && course.materialsIncluded.length > 0 ? (
                  <section>
                    <h2 className="text-xl font-bold text-gray-900">What&apos;s included</h2>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
                      {course.materialsIncluded.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {course.trainingTags && course.trainingTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {course.trainingTags.map((t) => (
                      <span key={t} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}

                {curriculumBlock}
              </div>
            </div>
          ) : (
            <div>
              {tabBar}
              <div className="mt-10 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-6 py-12 text-center">
                <p className="text-sm font-medium text-gray-700">No reviews yet</p>
                <p className="mt-1 text-xs text-gray-500">Learner ratings will appear here once reviews are enabled.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
