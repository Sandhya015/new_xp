import { useCallback, useEffect, useState } from 'react'
import { Calendar, CheckCircle2, Clock, Phone, Plus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { isLeadAgentOnly } from '@/constants/adminAccess'
import { crmService, type CrmFollowUpStats, type CrmLead } from '@/services/crmService'
import { LeadDetailDrawer } from './LeadDetailDrawer'
import { CallLeadModal } from './CallLeadModal'
import { CreateFollowUpModal } from './CreateFollowUpModal'
import { RescheduleFollowUpModal } from './RescheduleFollowUpModal'
import { leadInitials, TEMP_COLORS } from './shared'

function bucketLead(lead: CrmLead): 'overdue' | 'today' | 'upcoming' {
  if (!lead.followUpAt) return 'upcoming'
  const d = new Date(lead.followUpAt)
  const now = new Date()
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)
  if (d.getTime() < now.getTime()) return 'overdue'
  if (d.getTime() <= todayEnd.getTime()) return 'today'
  return 'upcoming'
}

function timeLabel(lead: CrmLead, bucket: string): string {
  if (!lead.followUpAt) return 'No date set'
  const d = new Date(lead.followUpAt)
  if (bucket === 'overdue') {
    const mins = Math.round((Date.now() - d.getTime()) / 60000)
    return `Overdue by ${mins} min`
  }
  if (bucket === 'today') return `Today, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function FollowUpCard({
  lead,
  onReassign,
  onReschedule,
  onCall,
  onComplete,
  agentView,
  completing,
}: {
  lead: CrmLead
  onReassign: () => void
  onReschedule: () => void
  onCall: () => void
  onComplete: () => void
  agentView?: boolean
  completing?: boolean
}) {
  const bucket = bucketLead(lead)
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="lc-avatar">{leadInitials(lead.fullName)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{lead.fullName}</p>
              <p className="text-xs text-slate-500">{lead.lastCourseTitle || lead.mobile}</p>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold capitalize ring-1 ${TEMP_COLORS[lead.temperature]}`}>
              {lead.temperature}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600">{lead.disposition?.replace(/_/g, ' ') || 'Follow-up scheduled'}</p>
          <p className="mt-2 text-xs text-slate-500">Owner: {lead.assignedToName || 'Unassigned'}</p>
          <p className={`mt-1 text-xs font-semibold ${bucket === 'overdue' ? 'text-red-600' : 'text-slate-600'}`}>
            {timeLabel(lead, bucket)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!agentView && (
          <button type="button" onClick={onReassign} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Reassign
          </button>
        )}
        <button type="button" onClick={onCall} className="inline-flex items-center gap-1 rounded-lg border border-[#2563eb]/30 px-2.5 py-1.5 text-xs font-medium text-[#2563eb] hover:bg-[#2563eb]/5">
          <Phone className="h-3 w-3" /> Call
        </button>
        <button type="button" onClick={onReschedule} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Reschedule</button>
        <button
          type="button"
          onClick={onComplete}
          disabled={completing}
          className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          Mark complete
        </button>
      </div>
    </div>
  )
}

export function LeadFollowUps() {
  const agentView = isLeadAgentOnly(useAuthStore((s) => s.user))
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [stats, setStats] = useState<CrmFollowUpStats | null>(null)
  const [drawerId, setDrawerId] = useState('')
  const [callLead, setCallLead] = useState<CrmLead | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [rescheduleLead, setRescheduleLead] = useState<CrmLead | null>(null)
  const [completingId, setCompletingId] = useState('')

  const load = useCallback(async () => {
    const data = await crmService.getFollowUps()
    setLeads(data.items)
    setStats(data.stats)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const complete = async (lead: CrmLead) => {
    setCompletingId(lead.id)
    try {
      await crmService.completeFollowUp(lead.id)
      await load()
    } finally {
      setCompletingId('')
    }
  }

  const overdue = leads.filter((l) => bucketLead(l) === 'overdue')
  const today = leads.filter((l) => bucketLead(l) === 'today')
  const upcoming = leads.filter((l) => bucketLead(l) === 'upcoming')

  const columns = [
    { id: 'overdue', title: 'Overdue', dot: 'bg-red-500', items: overdue },
    { id: 'today', title: 'Due today', dot: 'bg-amber-500', items: today },
    { id: 'upcoming', title: 'Upcoming', dot: 'bg-blue-500', items: upcoming },
  ]

  return (
    <div className="space-y-5">
      <div className="lc-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {agentView ? 'My follow-ups — create and manage callbacks' : 'Assign and monitor callbacks'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-1">Select lead</span>
              <span>→</span>
              <span className="rounded-full bg-slate-100 px-2 py-1">Set date &amp; reason</span>
              <span>→</span>
              <span className="rounded-full bg-slate-100 px-2 py-1">{agentView ? 'Added to my queue' : 'Added to agent queue'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> {agentView ? 'Create follow-up' : 'Assign follow-up'}
          </button>
        </div>
      </div>

      <div className="lc-kpi-row">
        <div className="lc-kpi-icon-card">
          <div className="lc-kpi-icon lc-kpi-icon--blue"><Calendar className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{agentView ? 'My open follow-ups' : 'Open team follow-ups'}</p>
            <p className="text-2xl font-bold">{stats?.open ?? leads.length}</p>
          </div>
        </div>
        <div className="lc-kpi-icon-card">
          <div className="lc-kpi-icon lc-kpi-icon--red"><Clock className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Overdue now</p>
            <p className="text-2xl font-bold text-red-600">{stats?.overdue ?? overdue.length}</p>
          </div>
        </div>
        <div className="lc-kpi-icon-card">
          <div className="lc-kpi-icon lc-kpi-icon--amber"><Phone className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Due today</p>
            <p className="text-2xl font-bold text-amber-600">{stats?.dueToday ?? today.length}</p>
          </div>
        </div>
        <div className="lc-kpi-icon-card">
          <div className="lc-kpi-icon lc-kpi-icon--green"><CheckCircle2 className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Completed on time</p>
            <p className="text-2xl font-bold">{stats?.completedOnTimePct ?? 0}%</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <div key={col.id}>
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <h3 className="text-sm font-semibold text-slate-800">{col.title}</h3>
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">{col.items.length}</span>
            </div>
            <div className="space-y-3">
              {col.items.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">None</p>
              ) : (
                col.items.map((l) => (
                  <FollowUpCard
                    key={l.id}
                    lead={l}
                    agentView={agentView}
                    completing={completingId === l.id}
                    onReassign={() => setDrawerId(l.id)}
                    onReschedule={() => setRescheduleLead(l)}
                    onCall={() => setCallLead(l)}
                    onComplete={() => void complete(l)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <CreateFollowUpModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => void load()} />
      {rescheduleLead && (
        <RescheduleFollowUpModal
          open={!!rescheduleLead}
          leadId={rescheduleLead.id}
          leadName={rescheduleLead.fullName}
          onClose={() => setRescheduleLead(null)}
          onSaved={() => void load()}
        />
      )}
      {drawerId && <LeadDetailDrawer leadId={drawerId} onClose={() => setDrawerId('')} />}
      <CallLeadModal open={!!callLead} lead={callLead} onClose={() => setCallLead(null)} />
    </div>
  )
}
