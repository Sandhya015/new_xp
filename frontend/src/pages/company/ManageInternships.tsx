import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListChecks, Plus, Eye, Pencil, Pause, Play, XCircle, Copy } from 'lucide-react'
import { internshipService, type InternshipListItem } from '@/services/internshipService'

/**
 * Company Dashboard — Manage Internships (CD-WF-06). Status tabs, table, action buttons. API wired.
 */
const TAB_IDS = ['all', 'active', 'draft', 'paused', 'closed', 'expired'] as const
const TAB_LABELS: Record<string, string> = {
  all: 'All',
  active: 'Active',
  draft: 'Draft',
  paused: 'Paused',
  closed: 'Closed',
  expired: 'Expired',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  draft: 'bg-blue-100 text-blue-800',
  paused: 'bg-amber-100 text-amber-800',
  closed: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
}

export function ManageInternships() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>('all')
  const [listings, setListings] = useState<InternshipListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    internshipService
      .listMine()
      .then((res) => setListings(res.items || []))
      .catch(() => setError('Failed to load internships.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered =
    activeTab === 'all'
      ? listings
      : listings.filter((l) => (l.status || 'active').toLowerCase() === activeTab)

  const counts: Record<string, number> = {}
  TAB_IDS.forEach((id) => {
    if (id === 'all') counts.all = listings.length
    else counts[id] = listings.filter((l) => (l.status || 'active').toLowerCase() === id).length
  })

  const handlePause = (row: InternshipListItem) => {
    if (!window.confirm('Pausing this listing will hide it from students. Existing applications are retained. Continue?')) return
    setActingId(row.id)
    internshipService
      .update(row.id, { status: 'paused' })
      .then(load)
      .catch(() => setError('Failed to pause listing.'))
      .finally(() => setActingId(null))
  }

  const handleReactivate = (row: InternshipListItem) => {
    if (!window.confirm('This will make the listing visible to students again. Continue?')) return
    setActingId(row.id)
    internshipService
      .update(row.id, { status: 'active' })
      .then(load)
      .catch(() => setError('Failed to re-activate listing.'))
      .finally(() => setActingId(null))
  }

  const handleClose = (row: InternshipListItem) => {
    if (!window.confirm('Closing this listing is permanent. No new applications will be accepted. Proceed?')) return
    setActingId(row.id)
    internshipService
      .update(row.id, { status: 'closed' })
      .then(load)
      .catch(() => setError('Failed to close listing.'))
      .finally(() => setActingId(null))
  }

  const handleDuplicate = async (row: InternshipListItem) => {
    setActingId(row.id)
    try {
      const full = await internshipService.getById(row.id)
      const title = `Copy of ${(full.title || row.title || '').replace(/^Copy of /, '')}`
      const payload: Record<string, unknown> = {
        title,
        description: full.description ?? '',
        requirements: full.requirements ?? '',
        skills: full.skills ?? '',
        domain: full.domain ?? '',
        duration: full.duration ?? '',
        type: full.type ?? 'remote',
        stipend: full.stipend ?? '',
        location: full.location ?? '',
        openings: full.openings ?? 1,
        deadline: full.deadline ?? '',
        featured: full.featured ?? false,
        status: 'draft',
      }
      await internshipService.create(payload)
      load()
      navigate('/company/post-internship')
    } catch {
      setError('Failed to duplicate listing.')
    } finally {
      setActingId(null)
    }
  }

  const statusLabel = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Active')

  return (
    <div className="space-y-6 w-full">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Manage Internships</h2>
        <Link
          to="/company/post-internship"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" /> Post Internship
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activeTab === id ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {TAB_LABELS[id]} {(counts[id] ?? 0) > 0 && `(${counts[id]})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-gray py-8">Loading...</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Posted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Deadline</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applicants</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <ListChecks className="mx-auto h-12 w-12 text-gray-300" />
                      <p className="mt-2 font-medium text-gray-600">No internships in this tab.</p>
                      {activeTab === 'all' && (
                        <Link to="/company/post-internship" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
                          <Plus className="h-4 w-4" /> Post Internship
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const st = (row.status || 'active').toLowerCase()
                    const applicantsCount = (row as InternshipListItem & { applicantsCount?: number }).applicantsCount ?? 0
                    const busy = actingId === row.id
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.title}</td>
                        <td className="px-4 py-3 text-sm text-slate-gray">{row.domain || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-gray">{row.createdAt || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-gray">{row.deadline || '—'}</td>
                        <td className="px-4 py-3">
                          <Link to={`/company/applicants?internshipId=${row.id}`} className="text-sm font-medium text-brand-accent hover:underline">
                            {applicantsCount}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[st] ?? 'bg-gray-100 text-gray-700'}`}>
                            {statusLabel(st)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link to={`/company/post-internship?edit=${row.id}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View / Edit"><Eye className="h-4 w-4" /></Link>
                            <Link to={`/company/post-internship?edit=${row.id}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit"><Pencil className="h-4 w-4" /></Link>
                            {st === 'active' && <button type="button" disabled={busy} onClick={() => handlePause(row)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Pause"><Pause className="h-4 w-4" /></button>}
                            {st === 'paused' && <button type="button" disabled={busy} onClick={() => handleReactivate(row)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Re-activate"><Play className="h-4 w-4" /></button>}
                            {(st === 'active' || st === 'paused') && <button type="button" disabled={busy} onClick={() => handleClose(row)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Close"><XCircle className="h-4 w-4" /></button>}
                            <button type="button" disabled={busy} onClick={() => handleDuplicate(row)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Duplicate"><Copy className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
