import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Search, Filter } from 'lucide-react'

/**
 * Student Dashboard — Training listing (Part 3A §4).
 * Layout: search, filters, program cards grid. API integration later.
 */
export function StudentTraining() {
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-6 w-full">
      <div className="rounded-lg border border-primary-200 bg-primary-50/50 px-4 py-3 text-sm text-brand-navy">
        <strong>Recommended for You</strong> — Programs matching your course and stream will appear here once connected to the backend.
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search by program name or technology..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Filter className="h-4 w-4" /> Filters
        </button>
      </div>

      <p className="text-sm text-slate-gray">
        Filters: University, Course, Stream, Mode, Duration, Hours, Fee Range, Enrolled toggle, Sort — (API wiring later)
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <BookOpen className="h-10 w-10 shrink-0 text-brand-accent" />
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Sample</span>
            </div>
            <h3 className="mt-3 font-semibold text-brand-navy">Program Title {i}</h3>
            <p className="mt-1 text-xs text-slate-gray">University · 4 Weeks · Online</p>
            <p className="mt-2 text-sm font-medium text-brand-navy">₹1,499</p>
            <div className="mt-4 flex gap-2">
              <Link
                to={`/dashboard/training/${i}`}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                View Details
              </Link>
              <Link
                to={`/dashboard/training/${i}`}
                className="flex-1 rounded-lg bg-brand-accent py-2 text-center text-sm font-semibold text-white hover:bg-primary-600"
              >
                Enroll Now
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
