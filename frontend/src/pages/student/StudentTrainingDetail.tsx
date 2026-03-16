import { Link, useParams } from 'react-router-dom'
import { BookOpen, ArrowLeft } from 'lucide-react'

/**
 * Student Dashboard — Program detail (Part 3A §4.3). Enrollment form & payment flow later.
 */
export function StudentTrainingDetail() {
  const { id } = useParams()

  return (
    <div className="space-y-6 w-full max-w-4xl">
      <Link to="/dashboard/training" className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Training
      </Link>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-light-bg">
            <BookOpen className="h-7 w-7 text-brand-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-navy">Program Title (ID: {id})</h1>
            <p className="mt-1 text-sm text-slate-gray">University · 4 Weeks · 60 hrs · Online</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-gray">
          Full description, curriculum, trainer info, fee details, and Enroll Now will be wired with API.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
          >
            Enroll Now
          </button>
          <button type="button" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Share
          </button>
        </div>
      </div>
    </div>
  )
}
