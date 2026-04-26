import { useEffect, useState } from 'react'
import { Loader2, Star } from 'lucide-react'
import { reviewService, type ReviewItem, type ReviewStats } from '@/services/reviewService'
import { useAuth } from '@/hooks/useAuth'

type Props = {
  courseId: string
  isEnrolled: boolean
}

function StarsRow({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  return (
    <div className="flex gap-0.5 text-amber-400" aria-hidden>
      {[1, 2, 3, 4, 5].map((k) => (
        <Star
          key={k}
          className={`${h} ${k <= rating ? 'fill-amber-400' : 'fill-none'} stroke-amber-400 stroke-[1.25]`}
        />
      ))}
    </div>
  )
}

function Breakdown({ stats }: { stats: ReviewStats }) {
  const total = stats.total || 0
  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const c = stats.breakdown[String(star)] || 0
        const pct = total > 0 ? Math.round((c / total) * 100) : 0
        return (
          <div key={star} className="flex items-center gap-2 text-sm">
            <span className="w-8 tabular-nums text-gray-600">{star}★</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right text-xs text-gray-500">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

export function CourseReviewsPanel({ courseId, isEnrolled }: Props) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sort, setSort] = useState('recent')
  const [myReview, setMyReview] = useState<ReviewItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const limit = 5

  useEffect(() => {
    setPage(1)
  }, [courseId, sort])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await reviewService.list(courseId, { page, limit, sort })
        if (!cancelled) {
          setStats(res.stats)
          setItems(res.items)
          setTotalPages(res.totalPages || 1)
        }
      } catch {
        if (!cancelled) setError('Could not load reviews.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [courseId, page, sort, refreshTick])

  useEffect(() => {
    if (!token || !courseId) {
      setMyReview(null)
      return
    }
    reviewService
      .myReview(courseId)
      .then((r) => setMyReview(r))
      .catch(() => setMyReview(null))
  }, [token, courseId])

  const openModal = () => {
    if (myReview) {
      setRating(myReview.rating)
      setTitle(myReview.title || '')
      setBody(myReview.body || '')
    } else {
      setRating(5)
      setTitle('')
      setBody('')
    }
    setModalOpen(true)
    setError(null)
  }

  const submitReview = async () => {
    setSubmitting(true)
    setError(null)
    try {
      if (myReview) {
        await reviewService.update(myReview.id, { rating, title: title.trim(), body: body.trim() })
      } else {
        await reviewService.create({ courseId, rating, title: title.trim(), body: body.trim() })
      }
      setModalOpen(false)
      setRefreshTick((t) => t + 1)
      const mine = await reviewService.myReview(courseId)
      setMyReview(mine)
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response
          ? String((e.response as { data?: { error?: string } }).data?.error || 'Could not save review')
          : 'Could not save review'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading reviews…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-5xl font-bold text-gray-900 tabular-nums">{stats?.average?.toFixed(1) ?? '0.0'}</p>
              <StarsRow rating={Math.round(stats?.average || 0)} />
              <p className="mt-2 text-sm text-gray-500">{stats?.total ?? 0} reviews</p>
            </div>
          </div>
          <div className="mt-6">
            <Breakdown stats={stats || { average: 0, total: 0, breakdown: {} }} />
          </div>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-6">
          {token && isEnrolled ? (
            <>
              <p className="text-sm font-medium text-gray-800">Share your experience</p>
              <p className="mt-1 text-sm text-gray-600">You can write one review per course and edit it anytime.</p>
              <button
                type="button"
                onClick={openModal}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
              >
                {myReview ? 'Edit your review' : 'Write a Review'}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-600">Enroll in this course to leave a review.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-gray-900">Learner reviews</h3>
        <label className="text-sm text-gray-600 flex items-center gap-2">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="recent">Most recent</option>
            <option value="helpful">Most helpful</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </label>
      </div>

      {error && !modalOpen ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="space-y-4">
        {items.map((r) => (
          <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{r.studentName}</p>
                <StarsRow rating={r.rating} size="sm" />
              </div>
              <time className="text-xs text-gray-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : ''}</time>
            </div>
            {r.title ? <p className="mt-2 font-medium text-gray-800">{r.title}</p> : null}
            <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>
          </li>
        ))}
      </ul>

      {items.length === 0 && !loading ? <p className="text-center text-sm text-gray-500 py-8">No reviews yet.</p> : null}

      {totalPages > 1 ? (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="self-center text-sm text-gray-600">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}

      {modalOpen ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" aria-hidden onClick={() => !submitting && setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-lg font-bold text-gray-900">{myReview ? 'Edit review' : 'Write a review'}</h4>
              <p className="mt-1 text-sm text-gray-500">Rating (required)</p>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="rounded p-1 text-amber-400 hover:bg-amber-50"
                    aria-label={`${n} stars`}
                  >
                    <Star className={`h-8 w-8 ${n <= rating ? 'fill-amber-400' : 'fill-none'} stroke-amber-400`} />
                  </button>
                ))}
              </div>
              <label className="mt-4 block text-sm font-medium text-gray-700">Review title (optional)</label>
              <input
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mt-3 block text-sm font-medium text-gray-700">Review (20–500 characters)</label>
              <textarea
                value={body}
                minLength={20}
                maxLength={500}
                rows={4}
                onChange={(e) => setBody(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">{body.trim().length} / 500</p>
              {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
              <div className="mt-4 flex gap-2 justify-end">
                <button type="button" disabled={submitting} className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting || body.trim().length < 20}
                  onClick={() => void submitReview()}
                  className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
