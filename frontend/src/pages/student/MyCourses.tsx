import { Link } from 'react-router-dom'

export function MyCourses() {
  return (
    <div className="max-w-6xl space-y-6">
      <p className="text-sm text-slate-gray">Enrolled courses and progress. Data from API when connected.</p>
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-gray-600">No enrollments yet.</p>
        <Link to="/training" className="mt-3 inline-block text-brand-accent font-semibold hover:underline">Browse courses</Link>
      </div>
    </div>
  )
}
