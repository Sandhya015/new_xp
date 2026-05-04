import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Play, CheckCircle, Award } from 'lucide-react'
import { enrollmentService, type EnrollmentItem } from '@/services/enrollmentService'
import { absoluteApiUrl } from '@/config/api'

function categoryBadgeClass(cat: string | undefined) {
  const c = (cat || '').toLowerCase()
  if (c === 'technical') return 'bg-emerald-500/95 text-white'
  if (c === 'non-technical') return 'bg-orange-500/95 text-white'
  return 'bg-slate-600/95 text-white'
}

function categoryLabel(cat: string | undefined) {
  const c = (cat || '').toLowerCase()
  if (c === 'technical') return 'Technical'
  if (c === 'non-technical') return 'Non-Technical'
  return c ? 'Other' : 'Course'
}

/**
 * Student Dashboard — My Enrolled Courses (SD-WF-09). Ongoing / Completed tabs. API wired.
 */
export function MyCourses() {
  const location = useLocation()
  const [tab, setTab] = useState<'ongoing' | 'completed'>('ongoing')
  const [items, setItems] = useState<EnrollmentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    enrollmentService
      .list()
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [location.pathname, location.key])

  /** Certificate issued (quiz path) or legacy status=completed. */
  const enrollmentIsCompleted = (e: EnrollmentItem) =>
    Boolean(e.certificateIssued) || String(e.status || '').toLowerCase() === 'completed'

  const ongoing = items.filter((e) => !enrollmentIsCompleted(e))
  const completed = items.filter((e) => enrollmentIsCompleted(e))

  return (
    <div className="space-y-6 w-full">
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab('ongoing')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            tab === 'ongoing'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Ongoing
        </button>
        <button
          type="button"
          onClick={() => setTab('completed')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            tab === 'completed'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Completed
        </button>
      </div>

      {tab === 'ongoing' && (
        <>
          {loading ? (
            <p className="py-8 text-slate-gray">Loading...</p>
          ) : ongoing.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 font-medium text-gray-600">You haven&apos;t enrolled in any training yet.</p>
              <Link to="/dashboard/training" className="mt-3 inline-block rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
                Explore Training
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {ongoing.map((c) => {
                const thumb = (c.courseFeaturedImageUrl || '').trim()
                  ? absoluteApiUrl(c.courseFeaturedImageUrl!.trim())
                  : ''
                const pct =
                  typeof c.curriculumProgressPercent === 'number' && !Number.isNaN(c.curriculumProgressPercent)
                    ? Math.min(100, Math.max(0, c.curriculumProgressPercent))
                    : null
                return (
                  <article
                    key={c.id}
                    className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">No thumbnail</div>
                      )}
                      <span
                        className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow ${categoryBadgeClass(c.courseCategory)}`}
                      >
                        {categoryLabel(c.courseCategory)}
                      </span>
                      <span className="absolute right-2 top-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 shadow">
                        Enrolled
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-semibold text-brand-navy line-clamp-2 text-base">{c.courseTitle || 'Course'}</h3>
                      <p className="mt-1 text-xs text-slate-gray">Started {c.createdAt}</p>
                      {c.lastAccessedAt ? (
                        <p className="mt-0.5 text-xs text-slate-gray">
                          Last accessed{' '}
                          {new Date(c.lastAccessedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      ) : null}
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-gray">
                        <span>{c.courseDuration || '—'}</span>
                        <span className="text-gray-300">·</span>
                        <span>{c.courseMode || '—'}</span>
                        <span className="text-gray-300">·</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                          {pct != null && pct > 0 ? 'In progress' : 'Not started'}
                        </span>
                      </p>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-gray">
                          <span>Progress</span>
                          <span>{pct != null ? `${pct}%` : '—'}</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-brand-accent transition-all"
                            style={{ width: pct != null ? `${pct}%` : '0%' }}
                          />
                        </div>
                      </div>
                      <Link
                        to={`/dashboard/my-courses/${c.courseId}`}
                        className="mt-4 inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-accent px-3 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
                      >
                        <Play className="h-4 w-4" /> Continue
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'completed' && (
        <>
          {loading ? (
            <p className="py-8 text-slate-gray">Loading...</p>
          ) : completed.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 font-medium text-gray-600">No completed trainings yet.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {completed.map((c) => {
                const thumb = (c.courseFeaturedImageUrl || '').trim()
                  ? absoluteApiUrl(c.courseFeaturedImageUrl!.trim())
                  : ''
                const pct =
                  typeof c.curriculumProgressPercent === 'number' && !Number.isNaN(c.curriculumProgressPercent)
                    ? Math.min(100, Math.max(0, c.curriculumProgressPercent))
                    : 100
                return (
                  <article
                    key={c.id}
                    className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">No thumbnail</div>
                      )}
                      <span
                        className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow ${categoryBadgeClass(c.courseCategory)}`}
                      >
                        {categoryLabel(c.courseCategory)}
                      </span>
                      <span className="absolute right-2 top-2 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-900 shadow">
                        Completed
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-semibold text-brand-navy line-clamp-2 text-base">{c.courseTitle || 'Course'}</h3>
                      <p className="mt-1 text-xs text-slate-gray">Started {c.createdAt}</p>
                      {c.lastAccessedAt ? (
                        <p className="mt-0.5 text-xs text-slate-gray">
                          Last accessed{' '}
                          {new Date(c.lastAccessedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-gray">Completed {c.completedAt || c.createdAt}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-gray">
                        <span>{c.courseDuration || '—'}</span>
                        <span className="text-gray-300">·</span>
                        <span>{c.courseMode || '—'}</span>
                        <span className="text-gray-300">·</span>
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-900">Completed</span>
                      </p>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-gray">
                          <span>Progress</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-brand-accent transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Link
                          to={`/dashboard/my-courses/${c.courseId}`}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-accent px-3 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
                        >
                          <Play className="h-4 w-4" /> View course
                        </Link>
                        <Link
                          to={`/dashboard/my-courses/${c.courseId}?tab=certificate`}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Award className="h-4 w-4" /> Certificate
                        </Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
