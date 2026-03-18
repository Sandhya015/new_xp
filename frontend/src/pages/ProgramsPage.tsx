import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { courseService } from '@/services/courseService'

type CourseItem = { id: string; title: string; duration: string; tag: string; description: string }

export function ProgramsPage() {
  const [items, setItems] = useState<CourseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    courseService.list({ limit: 50 })
      .then((res) => { if (!cancelled) setItems((res.items || []) as CourseItem[]) })
      .catch(() => { if (!cancelled) setError('Failed to load courses') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-brand-navy">Programs & Courses</h1>
        <p className="mt-2 text-gray-600">Industry-ready training aligned with AICTE and UGC guidelines.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading courses...</p>}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((prog) => (
          <article
            key={prog.id}
            className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md"
          >
            <div className="flex-1 p-6">
              <span className="rounded bg-primary-100 px-2 py-1 text-xs font-medium text-brand-accent">{prog.tag || 'Course'}</span>
              <h2 className="mt-3 text-lg font-semibold text-brand-navy">{prog.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{prog.description || ''}</p>
              <p className="mt-2 text-sm text-gray-500">{prog.duration} · Live sessions · Projects · Certificate</p>
            </div>
            <div className="border-t border-gray-100 p-4 flex gap-3">
              <Link to={`/training/${prog.id}`} className="text-sm font-semibold text-brand-accent hover:underline">
                View Details
              </Link>
              <Link to="/register" className="text-sm font-semibold text-brand-navy hover:underline">
                Enroll
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!loading && !error && items.length === 0 && (
        <p className="mt-8 text-center text-sm text-gray-500">No courses available yet.</p>
      )}
    </div>
  )
}
