import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Eye, MessageSquare, X, Building2, Award } from 'lucide-react'
import { adminService, type CompanyRow } from '@/services/adminService'

/**
 * Admin — Company Management. Part 5A §10. Approve/reject companies, verified badge, account actions.
 */
const TABS = [
  { id: 'pending', label: 'Pending Approval' },
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Suspended' },
]

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  Active: 'bg-emerald-100 text-emerald-800',
  Suspended: 'bg-red-100 text-red-800',
  Rejected: 'bg-red-100 text-red-800',
}

type CompanyDetail = CompanyRow & { hrName?: string; hrMobile?: string; address?: string; website?: string }

export function CompanyManagement() {
  const [activeTab, setActiveTab] = useState('pending')
  const [items, setItems] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detailCompany, setDetailCompany] = useState<CompanyDetail | null>(null)
  const [showReject, setShowReject] = useState(false)
  const [showRequestInfo, setShowRequestInfo] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [requestInfoMessage, setRequestInfoMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    const status = activeTab === 'pending' ? 'pending' : activeTab === 'suspended' ? 'suspended' : 'active'
    adminService.getCompanies({ status }).then((r) => setItems(r.items || [])).catch(() => setItems([])).finally(() => setLoading(false))
  }, [activeTab])

  const openDetail = (row: CompanyRow) => {
    adminService.getCompany(row.id).then((d) => setDetailCompany(d))
  }

  const handleApprove = (id: string) => {
    setSaving(true)
    adminService.approveCompany(id).then(() => { setDetailCompany(null); adminService.getCompanies({ status: activeTab }).then((r) => setItems(r.items || [])) }).finally(() => setSaving(false))
  }

  const handleReject = () => {
    if (!detailCompany || !rejectReason.trim()) return
    setSaving(true)
    adminService.rejectCompany(detailCompany.id, rejectReason.trim()).then(() => { setShowReject(false); setRejectReason(''); setDetailCompany(null); adminService.getCompanies({ status: activeTab }).then((r) => setItems(r.items || [])) }).finally(() => setSaving(false))
  }

  const handleRequestInfo = () => {
    if (!detailCompany) return
    setSaving(true)
    adminService.requestCompanyInfo(detailCompany.id, requestInfoMessage.trim()).then(() => { setShowRequestInfo(false); setRequestInfoMessage('') }).finally(() => setSaving(false))
  }

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-lg font-semibold text-brand-navy">Company Management</h2>
      <p className="text-sm text-slate-gray">Review, approve, and manage registered companies. Grant Verified badge, activate/deactivate accounts.</p>

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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Industry</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Contact Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Registered</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Listings</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applicants</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-gray">No companies in this tab.</td></tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-brand-navy">
                        {row.name}
                        {row.verified && <span className="ml-1.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800">Verified</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.industry}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.contactEmail}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.registered}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.listings}</td>
                      <td className="px-4 py-3 text-sm text-slate-gray">{row.applicants}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700'}`}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => openDetail(row)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Review"><Eye className="h-4 w-4" /></button>
                          {row.status === 'Pending' && (
                            <>
                              <button type="button" onClick={() => handleApprove(row.id)} disabled={saving} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50" title="Approve"><CheckCircle className="h-4 w-4" /></button>
                              <button type="button" onClick={() => { openDetail(row); setShowReject(true) }} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Reject"><XCircle className="h-4 w-4" /></button>
                            </>
                          )}
                          <button type="button" onClick={() => { openDetail(row); setShowRequestInfo(true) }} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Request more info"><MessageSquare className="h-4 w-4" /></button>
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

      {detailCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-brand-navy flex items-center gap-2">
                <Building2 className="h-5 w-5" /> {detailCompany.name}
                {detailCompany.verified && <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800"><Award className="h-3 w-3" /> Verified</span>}
              </h3>
              <button type="button" onClick={() => { setDetailCompany(null); setShowReject(false); setShowRequestInfo(false) }} className="rounded p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <p><span className="font-medium text-gray-700">Industry:</span> {detailCompany.industry}</p>
              <p><span className="font-medium text-gray-700">Contact:</span> {detailCompany.contactEmail}</p>
              <p><span className="font-medium text-gray-700">Registered:</span> {detailCompany.registered}</p>
              <p><span className="font-medium text-gray-700">Listings / Applicants:</span> {detailCompany.listings} / {detailCompany.applicants}</p>
              <p><span className="font-medium text-gray-700">Status:</span> <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detailCompany.status]}`}>{detailCompany.status}</span></p>
            </div>
            <div className="p-4 border-t border-gray-200 flex flex-wrap gap-2">
              {detailCompany.status === 'Pending' && (
                <>
                  <button type="button" onClick={() => handleApprove(detailCompany.id)} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Approve</button>
                  <button type="button" onClick={() => setShowReject(true)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Reject</button>
                </>
              )}
              <button type="button" onClick={() => setShowRequestInfo(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Request More Info</button>
              <button type="button" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">{detailCompany.verified ? 'Revoke Verified Badge' : 'Grant Verified Badge'}</button>
              <button type="button" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Edit Profile</button>
              <button type="button" className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700">Deactivate / Suspend</button>
            </div>
          </div>
        </div>
      )}
      {showReject && detailCompany && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Reject company</h3>
            <p className="mt-1 text-sm text-slate-gray">Reason is required. Company will receive rejection email.</p>
            <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowReject(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" onClick={handleReject} disabled={saving || !rejectReason.trim()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Submit Reject</button>
            </div>
          </div>
        </div>
      )}
      {showRequestInfo && detailCompany && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Request more info</h3>
            <p className="mt-1 text-sm text-slate-gray">Company will receive an email. Status remains Pending.</p>
            <textarea rows={3} value={requestInfoMessage} onChange={(e) => setRequestInfoMessage(e.target.value)} placeholder="Questions or required documents" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowRequestInfo(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" onClick={handleRequestInfo} disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
