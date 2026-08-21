import { useEffect, useState } from 'react'
import { Calendar, CheckCircle2, Clock, Phone, Play, Radio } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { isLeadAgentOnly } from '@/constants/adminAccess'
import { crmService } from '@/services/crmService'
import { CallLeadModal } from './CallLeadModal'
import { leadInitials } from './shared'
import type { CrmLead } from '@/services/crmService'

type CallRow = {
  id: string
  leadId: string | null
  leadName: string
  leadMobile: string | null
  agentName: string
  status: string
  durationSec?: number
  recordingUrl?: string
  createdAt: string | null
}

function fmtDuration(sec?: number): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `Today, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function outcomeClass(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('connect') || s.includes('answer') || s.includes('complete')) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }
  if (s.includes('no') || s.includes('miss') || s.includes('fail')) {
    return 'bg-amber-50 text-amber-800 ring-amber-200'
  }
  return 'bg-slate-50 text-slate-600 ring-slate-200'
}

export function LeadCallsRecordings() {
  const agentView = isLeadAgentOnly(useAuthStore((s) => s.user))
  const [stats, setStats] = useState({ totalCalls: 0, connected: 0, avgDurationSec: 0, followUpsSet: 0 })
  const [items, setItems] = useState<CallRow[]>([])
  const [loading, setLoading] = useState(true)
  const [callLead, setCallLead] = useState<CrmLead | null>(null)

  useEffect(() => {
    crmService.getCallLog(50).then((r) => {
      setStats(r.stats)
      setItems(r.items)
    }).finally(() => setLoading(false))
  }, [])

  const openCall = async (leadId: string | null) => {
    if (!leadId) return
    try {
      const d = await crmService.getLead(leadId)
      setCallLead(d.lead)
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5">
      <div className="lc-kpi-row">
        {[
          { label: agentView ? 'Calls today' : 'Total calls', value: stats.totalCalls, icon: Phone, color: 'blue' },
          { label: 'Connected', value: stats.connected, icon: CheckCircle2, color: 'blue' },
          { label: 'Avg. duration', value: fmtDuration(stats.avgDurationSec), icon: Clock, color: 'blue' },
          { label: 'Follow-ups set', value: stats.followUpsSet, icon: Calendar, color: 'blue' },
        ].map((s) => (
          <div key={s.label} className="lc-kpi-icon-card">
            <div className={`lc-kpi-icon lc-kpi-icon--${s.color}`}><s.icon className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-semibold text-slate-500">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="lc-card overflow-hidden">
        <div className="lc-card-head">
          <div>
            <h3 className="lc-card-title">{agentView ? 'My TeleCMI call history' : 'TeleCMI call log'}</h3>
            {agentView && <p className="text-xs text-slate-500">Only your calls and recordings are shown</p>}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <Radio className="h-3 w-3" /> TeleCMI connected
          </span>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading call log…</p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No calls logged yet. Use click-to-call from Lead Inbox.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="lc-table min-w-full">
              <thead>
                <tr>
                  <th className="pl-4">{agentView ? 'Student' : 'Lead'}</th>
                  {!agentView && <th>Agent</th>}
                  <th>Time</th>
                  <th>Duration</th>
                  <th>Outcome</th>
                  <th>Recording</th>
                  <th className="pr-4" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="pl-4">
                      <div className="flex items-center gap-3">
                        <span className="lc-avatar">{leadInitials(row.leadName)}</span>
                        <div>
                          <p className="font-semibold">{row.leadName}</p>
                          <p className="text-xs text-slate-500">{row.leadMobile || '—'}</p>
                        </div>
                      </div>
                    </td>
                    {!agentView && <td>{row.agentName}</td>}
                    <td className="whitespace-nowrap">{fmtTime(row.createdAt)}</td>
                    <td>{fmtDuration(row.durationSec)}</td>
                    <td>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 capitalize ${outcomeClass(row.status)}`}>
                        {row.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {row.recordingUrl ? (
                        <a href={row.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563eb]">
                          <Play className="h-3.5 w-3.5" /> Play
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Not available</span>
                      )}
                    </td>
                    <td className="pr-4">
                      <button type="button" onClick={() => openCall(row.leadId)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2563eb]/25 text-[#2563eb]">
                        <Phone className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CallLeadModal open={!!callLead} lead={callLead} onClose={() => setCallLead(null)} />
    </div>
  )
}
