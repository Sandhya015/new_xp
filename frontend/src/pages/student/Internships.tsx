import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Search, MapPin } from 'lucide-react'
import { internshipService } from '@/services/internshipService'

type Item = { id: string; title: string; companyName: string; domain: string; duration: string; type: string; stipend: string; deadline: string; featured?: boolean }

export function Internships() {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    internshipService.list({ search: search || undefined })
      .then((res) => { if (!cancelled) setItems(res.items || []) })
      .catch(() => { if (!cancelled) setError('Failed to load internships') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search])

  return (
    <div className="space-y-6 w-full">
      <div className="rounded-lg border border-primary-200 bg-primary-50/50 px-4 py-3 text-sm text-brand-navy">
        <strong>Matching Your Profile</strong> — Internships from companies are listed below.
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

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-gray">Loading...</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {item.featured && (
              <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 mb-2">Featured</span>
            )}
            <Briefcase className="h-10 w-10 text-brand-accent mb-2" />
            <h3 className="font-semibold text-brand-navy">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-gray">{item.companyName}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-gray">
              <span>{item.domain}</span>
              <span>·</span>
              <span>{item.duration}</span>
              <span>·</span>
              <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {item.type}</span>
              <span>·</span>
              <span>{item.stipend || '—'}</span>
            </div>
            {item.deadline && <p className="mt-2 text-xs text-slate-gray">Apply by {item.deadline}</p>}
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
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-slate-gray">No internships posted yet.</p>
      )}
    </div>
  )
}
