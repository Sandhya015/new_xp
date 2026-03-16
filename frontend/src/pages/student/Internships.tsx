import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Search, MapPin } from 'lucide-react'

/**
 * Student Dashboard — Internships listing (Part 3A §5). Browse, filter, apply. API later.
 */
export function Internships() {
  const [search, setSearch] = useState('')

  const items = [
    { id: '1', title: 'Web Development Intern', company: 'Tech Solutions Pvt Ltd', domain: 'Web Dev', duration: '2 Months', type: 'Remote', stipend: 'Paid', deadline: 'Mar 15, 2025', featured: true },
    { id: '2', title: 'Data Science Intern', company: 'DataCorp India', domain: 'Data Science', duration: '3 Months', type: 'Hybrid', stipend: 'Paid', deadline: 'Mar 20, 2025', featured: false },
  ]

  return (
    <div className="space-y-6 w-full">
      <div className="rounded-lg border border-primary-200 bg-primary-50/50 px-4 py-3 text-sm text-brand-navy">
        <strong>Matching Your Profile</strong> — Internships matching your course and stream will appear here when the backend is connected.
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          placeholder="Search by role, company, or domain..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        />
      </div>

      <p className="text-sm text-slate-gray">Filters: Domain, Type, Duration, Stipend, Eligibility, Status, Sort — (API wiring later)</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {item.featured && (
              <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 mb-2">Featured</span>
            )}
            <Briefcase className="h-10 w-10 text-brand-accent mb-2" />
            <h3 className="font-semibold text-brand-navy">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-gray">{item.company}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-gray">
              <span>{item.domain}</span>
              <span>·</span>
              <span>{item.duration}</span>
              <span>·</span>
              <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {item.type}</span>
              <span>·</span>
              <span>{item.stipend}</span>
            </div>
            <p className="mt-2 text-xs text-slate-gray">Apply by {item.deadline}</p>
            <div className="mt-4 flex gap-2">
              <Link to={`/dashboard/internships/${item.id}`} className="flex-1 rounded-lg border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">
                View Details
              </Link>
              <Link to={`/dashboard/internships/${item.id}`} className="flex-1 rounded-lg bg-brand-accent py-2 text-center text-sm font-semibold text-white hover:bg-primary-600">
                Apply Now
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
