import { useParams, Link } from 'react-router-dom'

export function CourseContent() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-brand-navy">Course Content</h1>
      <p className="mt-2 text-gray-600">Course ID: {id}. PDFs, Meet link, Quiz, Downloads — from API.</p>
      <Link to="/dashboard/courses" className="mt-6 inline-block text-brand-accent font-semibold hover:underline">← Back to My Courses</Link>
    </div>
  )
}
