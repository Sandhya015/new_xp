import type { CrmLead } from '@/services/crmService'

export const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700 ring-slate-200',
  assigned: 'bg-blue-50 text-blue-700 ring-blue-200',
  interested: 'bg-sky-50 text-sky-700 ring-sky-200',
  follow_up_scheduled: 'bg-amber-50 text-amber-800 ring-amber-200',
  payment_pending: 'bg-violet-50 text-violet-700 ring-violet-200',
  enrolled: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  qualified: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  connected: 'bg-teal-50 text-teal-700 ring-teal-200',
  attempted: 'bg-slate-50 text-slate-600 ring-slate-200',
}

export const TEMP_COLORS: Record<string, string> = {
  hot: 'bg-red-50 text-red-700 ring-red-200',
  warm: 'bg-amber-50 text-amber-800 ring-amber-200',
  cold: 'bg-slate-50 text-slate-600 ring-slate-200',
}

export const LIFECYCLE_LABEL: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  attempted: 'Attempted',
  connected: 'Connected',
  interested: 'Interested',
  follow_up_scheduled: 'Follow-up',
  payment_pending: 'Payment pending',
  enrolled: 'Enrolled',
  not_interested: 'Not interested',
  no_response: 'No response',
  invalid: 'Invalid',
  dnd: 'DND',
}

export const SOURCE_LABEL: Record<string, string> = {
  contact_us: 'Contact Us',
  callback: 'Callback',
  training_interest: 'Training Interest',
  registration: 'Registration',
  payment_recovery: 'Payment Recovery',
  converted: 'Converted',
  inbound: 'Inbound',
  campaigns: 'Campaign',
  uploads: 'Upload',
  'manual.entry': 'Manual entry',
  'training.interest': 'Training Interest',
  'callback.requested': 'Callback',
  campaign: 'Campaign',
  'contact.submitted': 'Contact form',
}

export function leadShortId(id: string): string {
  return `XI-${id.slice(-4).toUpperCase()}`
}

export function leadCategoryLine(lead: CrmLead): string {
  const src = SOURCE_LABEL[lead.lastSource || ''] || lead.lastSource?.replace(/\./g, ' ') || 'Lead'
  const stage = LIFECYCLE_LABEL[lead.lifecycleStage] || lead.lifecycleStage?.replace(/_/g, ' ') || 'New'
  return `${src} · ${stage}`
}

export function leadInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name.slice(0, 2) || '?').toUpperCase()
}

/** Mask for call modal — e.g. +91 93****2143 */
export function maskMobileDisplay(mobile: string | null | undefined): string {
  if (!mobile) return '—'
  const digits = mobile.replace(/\D/g, '')
  if (digits.length >= 10) {
    const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.slice(-10)
    return `+91 ${local.slice(0, 2)}****${local.slice(-4)}`
  }
  if (digits.length >= 4) return `+91 ****${digits.slice(-4)}`
  return '—'
}

export function formatNextAction(lead: CrmLead): { text: string; urgent?: boolean } {
  if (!lead.assignedToName) return { text: 'Assign lead', urgent: true }
  if (lead.followUpAt) {
    const d = new Date(lead.followUpAt)
    const now = Date.now()
    if (d.getTime() < now) {
      const mins = Math.round((now - d.getTime()) / 60000)
      return { text: `Overdue ${mins} min`, urgent: true }
    }
    return { text: d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) }
  }
  if (lead.temperature === 'hot' && lead.lifecycleStage === 'new') {
    return { text: 'Call within 15 min', urgent: true }
  }
  return { text: 'Follow up' }
}

export function PageActions({ onExport, exporting }: { onExport?: () => void; exporting?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {onExport && (
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Export
        </button>
      )}
    </div>
  )
}
