import { Link } from 'react-router-dom'

interface CourseCardProps {
  id: string
  title: string
  duration: string
  tag: string
  description?: string
}

export function CourseCard({ id, title, duration, tag, description }: CourseCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden transition hover:shadow-lg min-w-0">
      <div className="bg-brand-light-bg p-4 sm:p-6">
        <span className="rounded bg-brand-accent/10 px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-brand-accent">{tag}</span>
        <h3 className="mt-2 sm:mt-3 text-base sm:text-lg font-semibold text-brand-navy break-words">{title}</h3>
        <p className="mt-1 text-xs sm:text-sm text-gray-600">{description ?? `${duration} · Live sessions & projects`}</p>
      </div>
      <div className="border-t border-gray-100 p-3 sm:p-4">
        <Link to={`/training/${id}`} className="text-xs sm:text-sm font-semibold text-brand-accent hover:underline">View Details →</Link>
      </div>
    </div>
  )
}
