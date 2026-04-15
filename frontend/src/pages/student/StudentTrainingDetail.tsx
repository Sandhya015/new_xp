import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookOpen, ArrowLeft, Loader2 } from 'lucide-react'
import { courseService } from '@/services/courseService'
import { plainTextFromHtml } from '@/utils/sanitizeHtml'
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout'
import { useAuth } from '@/hooks/useAuth'

type CourseDetail = {
  id: string
  title: string
  description: string
  category: string
  duration: string
  mode: string
  universities: string
  price: number
  tag?: string
}

export function StudentTrainingDetail() {
  const { id } = useParams()
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, token } = useAuth()
  const { startCheckout, busy: payBusy, error: payError, clearError: clearPayError } = useRazorpayCheckout()

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('Invalid program link.')
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    courseService
      .getById(id)
      .then((data) => {
        if (cancelled) return
        setCourse(data as CourseDetail)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Program not found or unavailable.')
          setCourse(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-gray w-full">
        <Loader2 className="h-6 w-6 animate-spin text-brand-accent" />
        <span>Loading program…</span>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="space-y-4 w-full max-w-4xl">
        <Link to="/dashboard/training" className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Training
        </Link>
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error || 'Program not found.'}</p>
      </div>
    )
  }

  const priceLabel = course.price > 0 ? `₹${course.price.toLocaleString('en-IN')}` : 'Free'

  return (
    <div className="space-y-6 w-full max-w-4xl">
      <Link to="/dashboard/training" className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Training
      </Link>

      {payError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex justify-between gap-4">
          <span>{payError}</span>
          <button type="button" className="shrink-0 font-medium underline" onClick={clearPayError}>
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-light-bg">
            <BookOpen className="h-7 w-7 text-brand-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-brand-navy">{course.title}</h1>
            <p className="mt-1 text-sm text-slate-gray">
              {course.universities} · {course.duration} · {course.mode}
            </p>
            <p className="mt-2 text-lg font-semibold text-brand-navy">{priceLabel}</p>
            {course.tag ? (
              <span className="mt-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{course.tag}</span>
            ) : null}
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-gray">
          <p className="whitespace-pre-wrap">
            {plainTextFromHtml(course.description || '') || 'No description provided.'}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={payBusy || !token}
            onClick={() =>
              startCheckout({
                courseId: course.id,
                courseTitle: course.title,
                price: course.price,
                prefill: {
                  name: user?.name,
                  email: user?.email,
                  contact: user?.mobile,
                },
              })
            }
            className="rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {payBusy ? 'Opening payment…' : course.price > 0 ? 'Enroll & Pay with Razorpay' : 'Enroll for free'}
          </button>
          <button type="button" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Share
          </button>
        </div>
        {!token ? (
          <p className="mt-3 text-xs text-amber-800">You need to be signed in to enroll.</p>
        ) : null}
      </div>
    </div>
  )
}
