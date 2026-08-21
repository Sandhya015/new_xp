import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { crmService } from '@/services/crmService'

type Props = {
  open: boolean
  leadId: string
  leadName: string
  onClose: () => void
  onSaved: () => void
}

export function RescheduleFollowUpModal({ open, leadId, leadName, onClose, onSaved }: Props) {
  const [followUpAt, setFollowUpAt] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const d = new Date()
    d.setHours(d.getHours() + 2)
    setFollowUpAt(d.toISOString().slice(0, 16))
    setNote('')
    setError('')
  }, [open, leadId])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await crmService.rescheduleFollowUp(leadId, {
        followUpAt: new Date(followUpAt).toISOString(),
        note: note.trim() || undefined,
      })
      onSaved()
      onClose()
    } catch {
      setError('Could not reschedule.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lc-modal-backdrop" onClick={onClose}>
      <div className="lc-modal max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Reschedule — {leadName}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">New date &amp; time</label>
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Note (optional)</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {loading ? 'Saving…' : 'Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
