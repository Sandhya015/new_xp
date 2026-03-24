import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { courseService } from '@/services/courseService'
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout'
import { Loader2 } from 'lucide-react'

type Course = { id: string; title: string; description: string; duration: string; mode: string; universities: string; price: number; tag: string }

export function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { startCheckout, busy, error: payError, clearError } = useRazorpayCheckout()

  useEffect(() => {
    if (!id) return
    let cancelled = false
    courseService.getById(id)
      .then((data) => { if (!cancelled) setCourse(data as Course) })
      .catch(() => { if (!cancelled) setError('Course not found') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-8 text-gray-600">Loading...</div>
  if (error || !course) return <div className="mx-auto max-w-7xl px-4 py-8 text-red-600">{error || 'Not found'}</div>

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8 min-w-0">
      <span className="rounded bg-primary-100 px-2 py-1 text-xs font-medium text-brand-accent">{course.tag || 'Course'}</span>
      <h1 className="mt-3 text-2xl font-bold text-brand-navy sm:text-3xl">{course.title}</h1>
      <p className="mt-2 text-sm text-gray-500">{course.duration} · {course.mode} · {course.universities}</p>
      <p className="mt-4 text-gray-600">{course.description}</p>
      {course.price > 0 && <p className="mt-2 font-semibold text-brand-navy">₹{course.price.toLocaleString('en-IN')}</p>}
      {course.price <= 0 && <p className="mt-2 text-sm font-medium text-success-green">Free enrollment</p>}

      {payError && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {payError}
        </p>
      )}

      <div className="mt-6 sm:mt-8 flex flex-wrap gap-3 sm:gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            clearError()
            void startCheckout({
              courseId: course.id,
              courseTitle: course.title,
              price: course.price,
            })
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 sm:px-5 min-h-[44px] text-sm font-semibold text-white hover:bg-primary-600 transition disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {course.price > 0 ? 'Pay & enroll' : 'Enroll free'}
        </button>
        <Link to="/training" className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 sm:px-5 min-h-[44px] text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Back to Training</Link>
        <Link to="/register" className="inline-flex items-center justify-center rounded-lg border border-brand-accent px-4 py-2.5 sm:px-5 min-h-[44px] text-sm font-semibold text-brand-accent hover:bg-brand-light-bg transition">Create account</Link>
      </div>
    </div>
  )
}
