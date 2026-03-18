/**
 * Admin — Lead detail (AD-WF-14). View lead, Follow-up Timeline, Assign, Add Follow-up, Update status, Mark as Enrolled, Send Email.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, User, Mail, Phone, Building2, MessageSquare, Plus, Send } from 'lucide-react'
import { adminService, type LeadDetail as LeadDetailType } from '@/services/adminService'

const STATUS_OPTIONS = ['new', 'contacted', 'interested', 'enrolled', 'not_interested', 'no_response']

export function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const [lead, setLead] = useState<LeadDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [assignTo, setAssignTo] = useState('')
  const [followUpType, setFollowUpType] = useState('Called')
  const [followUpNotes, setFollowUpNotes] = useState('')

  useEffect(() => {
    if (!id) return
    adminService.getLead(id).then(setLead).catch(() => setLead(null)).finally(() => setLoading(false))
  }, [id])

  const handleStatusChange = (newStatus: string) => {
    if (!id || saving) return
    setSaving(true)
    adminService.updateLead(id, { status: newStatus }).then(setLead).finally(() => setSaving(false))
  }

  const handleAssign = () => {
    if (!id || saving) return
    setSaving(true)
    adminService.updateLead(id, { assignedTo: assignTo }).then(setLead).then(() => { setShowAssign(false); setAssignTo('') }).finally(() => setSaving(false))
  }

  const handleAddFollowUp = () => {
    if (!id || saving) return
    setSaving(true)
    adminService.updateLead(id, { followUp: { type: followUpType, notes: followUpNotes } }).then(setLead).then(() => { setShowFollowUp(false); setFollowUpNotes('') }).finally(() => setSaving(false))
  }

  if (loading) return <div className="p-6 text-slate-gray">Loading lead…</div>
  if (!lead) return <div className="p-6 text-red-600">Lead not found.</div>

  return (
    <div className="space-y-6 w-full max-w-4xl">
      <div className="flex items-center gap-4">
        <Link to="/admin/leads" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold text-brand-navy">Lead Details</h2>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-brand-navy">{lead.name || `Lead #${id}`}</h3>
                <p className="text-sm text-slate-gray">From contact form. Assigned to: {lead.assignedTo || '—'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAssign(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Assign
              </button>
              <button
                type="button"
                onClick={() => setShowFollowUp(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> Add Follow-up
              </button>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Send className="h-4 w-4" /> Send Email
              </button>
              <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Mark as Enrolled
              </button>
            </div>
          </div>
        </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-gray" /> {lead.email || '—'}</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-gray" /> {lead.mobile || '—'}</li>
              <li className="flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-gray" /> {lead.university || '—'} · {lead.course || '—'}</li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Status</h4>
            <select
              value={lead.status || 'new'}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={saving}
              className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-gray-200 p-6">
          <h4 className="font-semibold text-brand-navy flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Follow-up Timeline
          </h4>
          <p className="mt-2 text-sm text-slate-gray">Activity Type (Called / WhatsApp / Email / Meeting), Date & Time, Notes.</p>
          {lead.followUps && lead.followUps.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {lead.followUps.map((fu, i) => (
                <li key={i} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm">
                  <span className="font-medium">{fu.type}</span> · {fu.createdAt} — {fu.notes}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-8 text-center text-sm text-slate-gray">
              No follow-up entries yet. Click &quot;Add Follow-up&quot; to log activity.
            </div>
          )}
        </div>
      </div>

      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Assign to staff</h3>
            <input type="text" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} placeholder="Staff name or ID" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAssign(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" onClick={handleAssign} disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}
      {showFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Add Follow-up</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Activity Type</label>
                <select value={followUpType} onChange={(e) => setFollowUpType(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option>Called</option>
                  <option>WhatsApp</option>
                  <option>Email</option>
                  <option>Meeting</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea rows={3} value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} placeholder="What was discussed / outcome" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowFollowUp(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" onClick={handleAddFollowUp} disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
