import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { crmService, type CrmLead } from '@/services/crmService'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  presetLeadId?: string
}

export function CreateFollowUpModal({ open, onClose, onSaved, presetLeadId }: Props) {
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [leadId, setLeadId] = useState(presetLeadId || '')
  const [followUpAt, setFollowUpAt] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setLeadId(presetLeadId || '')
    setError('')
    crmService.listLeads({ limit: 100 }).then((r) => setLeads(r.items)).catch(() => setLeads([]))
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    setFollowUpAt(tomorrow.toISOString().slice(0, 16))
  }, [open, presetLeadId])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadId || !followUpAt || !note.trim()) {
      setError('Lead, date and note are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await crmService.scheduleFollowUp(leadId, {
        followUpAt: new Date(followUpAt).toISOString(),
        note: note.trim(),
      })
      onSaved()
      onClose()
    } catch {
      setError('Could not schedule follow-up.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lc-modal-backdrop" onClick={onClose}>
      <div className="lc-modal max-w-md" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Schedule follow-up</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Lead</label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            >
              <option value="">Select lead…</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.fullName} · {l.mobile || l.email || l.id.slice(-6)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Follow-up date &amp; time</label>
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Reason / note</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Confirm payment after guardian discussion"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {loading ? 'Saving…' : 'Create follow-up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
