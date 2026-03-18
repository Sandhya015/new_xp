import { useEffect, useState } from 'react'
import { Briefcase, CheckCircle, XCircle, Star, Eye, X } from 'lucide-react'
import { adminService, type InternshipRow } from '@/services/adminService'

/**
 * Admin — Internship Management (Moderation). Part 5A §11. Review company-posted listings.
 */
const TABS = [
  { id: 'pending_approval', label: 'Pending Approval' },
  { id: 'active', label: 'Active' },
  { id: 'closed', label: 'Closed' },
]

const STATUS_COLORS: Record<string, string> = {
  'Pending Approval': 'bg-amber-100 text-amber-800',
  Active: 'bg-emerald-100 text-emerald-800',
  Paused: 'bg-gray-100 text-gray-800',
  Closed: 'bg-red-100 text-red-800',
  Rejected: 'bg-red-100 text-red-800',
  Expired: 'bg-gray-100 text-gray-600',
}

export function InternshipManagement() {
  const [activeTab, setActiveTab] = useState('pending_approval')
  const [items, setItems] = useState<InternshipRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detailListing, setDetailListing] = useState<(InternshipRow & { description?: string; requirements?: string; skills?: string; stipend?: string; location?: string; openings?: number }) | null>(null)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    const status = activeTab === 'pending_approval' ? 'pending_approval' : activeTab === 'closed' ? 'closed' : 'active'
    adminService.getInternships({ status }).then((r) => setItems(r.items || [])).catch(() => setItems([])).finally(() => setLoading(false))
  }, [activeTab])

  const openDetail = (row: InternshipRow) => {
    adminService.getInternship(row.id).then(setDetailListing).catch(() => setDetailListing(null))
  }

  const refreshList = () => {
    const status = activeTab === 'pending_approval' ? 'pending_approval' : activeTab === 'closed' ? 'closed' : 'active'
    adminService.getInternships({ status }).then((r) => setItems(r.items || []))
  }

  const handleApprove = async (id: string) => {
    setSaving(true)
    try {
      await adminService.approveInternship(id)
      setDetailListing(null)
      refreshList()
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    if (!detailListing || !rejectReason.trim()) return
    setSaving(true)
    try {
      await adminService.rejectInternship(detailListing.id, rejectReason.trim())
      setShowReject(false)
      setDetailListing(null)
      setRejectReason('')
      refreshList()
    } finally {
      setSaving(false)
    }
  }

  const handleFeature = async (id: string) => {
    setSaving(true)
    try {
      await adminService.featureInternship(id)
      if (detailListing?.id === id) adminService.getInternship(id).then(setDetailListing)
      refreshList()
    } finally {
      setSaving(false)
    }
  }

  const handleForceClose = async (id: string) => {
    setSaving(true)
    try {
      await adminService.forceCloseInternship(id)
      setDetailListing(null)
      refreshList()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-lg font-semibold text-brand-navy">Internship Management</h2>
      <p className="text-sm text-slate-gray">Review and moderate company-posted internship listings before they go live.</p>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activeTab === tab.id ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-gray">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Posted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Deadline</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applicants</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <Briefcase className="mx-auto h-12 w-12 text-gray-300" />
                      <p className="mt-2 font-medium text-gray-600">No listings in this status.</p>
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.title}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.companyName}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.category}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.type}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.posted}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.deadline}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.applicants}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => openDetail(row)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View"><Eye className="h-4 w-4" /></button>
                          {row.status === 'Pending Approval' && (
                            <>
                              <button type="button" onClick={() => handleApprove(row.id)} disabled={saving} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50" title="Approve"><CheckCircle className="h-4 w-4" /></button>
                              <button type="button" onClick={() => { openDetail(row); setShowReject(true) }} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Reject"><XCircle className="h-4 w-4" /></button>
                            </>
                          )}
                          {row.active && <button type="button" onClick={() => handleFeature(row.id)} disabled={saving} className="rounded p-1.5 text-amber-600 hover:bg-amber-50" title="Feature"><Star className="h-4 w-4" /></button>}
                          {row.active && <button type="button" onClick={() => handleForceClose(row.id)} disabled={saving} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Force close">Close</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-brand-navy flex items-center gap-2"><Briefcase className="h-5 w-5" /> {detailListing.title}</h3>
              <button type="button" onClick={() => { setDetailListing(null); setShowReject(false) }} className="rounded p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <p><span className="font-medium text-gray-700">Company:</span> {detailListing.companyName}</p>
              <p><span className="font-medium text-gray-700">Category / Type:</span> {detailListing.category} · {detailListing.type}</p>
              <p><span className="font-medium text-gray-700">Posted / Deadline:</span> {detailListing.posted} / {detailListing.deadline}</p>
              <p><span className="font-medium text-gray-700">Applicants:</span> {detailListing.applicants}</p>
              <p><span className="font-medium text-gray-700">Description:</span> {detailListing.description || '—'}</p>
              <p><span className="font-medium text-gray-700">Status:</span> <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detailListing.status]}`}>{detailListing.status}</span></p>
            </div>
            <div className="p-4 border-t border-gray-200 flex flex-wrap gap-2">
              {detailListing.status === 'Pending Approval' && (
                <>
                  <button type="button" onClick={() => handleApprove(detailListing.id)} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Approve</button>
                  <button type="button" onClick={() => setShowReject(true)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Reject</button>
                </>
              )}
              {detailListing.active && <button type="button" onClick={() => handleFeature(detailListing.id)} disabled={saving} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700">Feature Listing</button>}
              {detailListing.active && <button type="button" onClick={() => handleForceClose(detailListing.id)} disabled={saving} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700">Force Close</button>}
            </div>
          </div>
        </div>
      )}
      {showReject && detailListing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Reject listing</h3>
            <p className="mt-1 text-sm text-slate-gray">Reason is required. Company will receive email with reason.</p>
            <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowReject(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" onClick={handleReject} disabled={saving || !rejectReason.trim()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Submit Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
