import { useParams, Link } from 'react-router-dom'

export function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  // TODO: fetch course by id from API
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8 min-w-0">
      <h1 className="text-2xl font-bold text-brand-navy sm:text-3xl">Course Detail</h1>
      <p className="mt-2 text-sm sm:text-base text-gray-600">Course ID: {id}. Full description, modules accordion, and Enroll CTA will load from API.</p>
      <div className="mt-6 sm:mt-8 flex flex-wrap gap-3 sm:gap-4">
        <Link to="/register" className="inline-flex items-center justify-center rounded-lg bg-brand-accent px-4 py-2.5 sm:px-5 min-h-[44px] text-sm font-semibold text-white hover:bg-primary-600 transition">Enroll Now</Link>
        <Link to="/training" className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 sm:px-5 min-h-[44px] text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Back to Training</Link>
      </div>
    </div>
  )
}
