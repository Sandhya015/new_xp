import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Phone, TrendingUp } from 'lucide-react'
import { crmService, type CrmLead } from '@/services/crmService'
import { CallLeadModal } from './CallLeadModal'
import { LeadDetailDrawer } from './LeadDetailDrawer'
import {
  LIFECYCLE_LABEL,
  SOURCE_LABEL,
  TEMP_COLORS,
  formatNextAction,
  leadInitials,
} from './shared'

const CALL_TARGET = 35

function intentBadge(temp: string, score: number) {
  const t = temp.charAt(0).toUpperCase() + temp.slice(1)
  return `${t} · ${score}`
}

export function AgentOverview() {
  const [assignedTotal, setAssignedTotal] = useState(0)
  const [newToday, setNewToday] = useState(0)
  const [followUpsDue, setFollowUpsDue] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)
  const [queue, setQueue] = useState<CrmLead[]>([])
  const [nextLead, setNextLead] = useState<CrmLead | null>(null)
  const [callsToday, setCallsToday] = useState(0)
  const [connectedToday, setConnectedToday] = useState(0)
  const [drawerId, setDrawerId] = useState('')
  const [callLead, setCallLead] = useState<CrmLead | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [myDay, assigned, followUps, calls] = await Promise.all([
          crmService.getMyDay(),
          crmService.listLeads({ limit: 1 }),
          crmService.listLeads({ followUpDue: true, limit: 50 }),
          crmService.getCallLog(50).catch(() => ({ stats: { totalCalls: 0, connected: 0 }, items: [] })),
        ])
        setAssignedTotal(assigned.total)
        setNewToday(myDay.newAssigned.length)
        setFollowUpsDue(followUps.total)
        const overdue = followUps.items.filter((l) => l.followUpAt && new Date(l.followUpAt).getTime() < Date.now())
        setOverdueCount(overdue.length)
        const combined = [
          ...myDay.hotUncontacted,
          ...myDay.followUps.filter((l) => !myDay.hotUncontacted.some((h) => h.id === l.id)),
          ...myDay.newAssigned.filter(
            (l) => !myDay.hotUncontacted.some((h) => h.id === l.id) && !myDay.followUps.some((f) => f.id === l.id),
          ),
        ]
        setQueue(combined.slice(0, 6))
        setNextLead(combined[0] || null)
        setCallsToday(calls.stats.totalCalls)
        setConnectedToday(calls.stats.connected)
      } catch {
        setQueue([])
      }
    })()
  }, [])

  const callPct = Math.min(100, Math.round((callsToday / CALL_TARGET) * 100))
  const connectRate = callsToday ? Math.round((connectedToday / callsToday) * 1000) / 10 : 0
  const remaining = Math.max(0, CALL_TARGET - callsToday)

  const progressRows = useMemo(
    () => [
      { label: 'Connected', value: connectedToday, pct: connectRate },
      { label: 'Interested', value: Math.round(connectedToday * 0.46), pct: connectedToday ? 44 : 0 },
      { label: 'Follow-ups set', value: followUpsDue, pct: assignedTotal ? Math.round((followUpsDue / assignedTotal) * 100) : 0 },
      { label: 'Enrolled', value: 0, pct: 0 },
    ],
    [connectedToday, connectRate, followUpsDue, assignedTotal],
  )

  return (
    <div className="space-y-5">
      <div className="lc-agent-calling-banner">
        <div className="flex items-start gap-3 min-w-0">
          <div className="lc-agent-calling-icon">
            <Phone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/90">My calling day</p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {remaining > 0 ? `${remaining} calls remaining today` : 'Daily call target reached'}
            </p>
            <p className="mt-1 text-xs text-emerald-100/75">
              {overdueCount > 0
                ? `Complete ${overdueCount} overdue follow-up${overdueCount === 1 ? '' : 's'} before new outreach.`
                : 'Work your queue in recommended order.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => nextLead && setCallLead(nextLead)}
          disabled={!nextLead}
          className="lc-agent-calling-btn"
        >
          Start next call
        </button>
      </div>

      <div className="lc-kpi-row">
        {[
          { label: 'Assigned leads', value: assignedTotal, delta: `${newToday} new today`, up: true },
          { label: 'Calls completed', value: `${callsToday} / ${CALL_TARGET}`, delta: `${callPct}% target`, up: true },
          { label: 'Follow-ups due', value: followUpsDue, delta: `${overdueCount} overdue`, up: false, warn: overdueCount > 0 },
          { label: 'Connected today', value: connectedToday, delta: `${connectRate}% rate`, up: true },
        ].map((row) => (
          <div key={row.label} className="lc-stat lc-stat--spark">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="lc-stat-label">{row.label}</p>
                <p className="lc-stat-value">{row.value}</p>
                <p className={`mt-1 text-xs font-medium ${row.warn ? 'text-red-600' : row.up ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {row.delta}
                </p>
              </div>
              <TrendingUp className="h-4 w-4 shrink-0 text-sky-400 opacity-80" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lc-card p-5 lg:col-span-3">
          <div className="mb-4">
            <h3 className="lc-card-title">Next best action</h3>
            <p className="text-xs text-slate-500">Prioritized by SLA and intent</p>
          </div>
          {nextLead ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="lc-avatar lc-avatar--lg">{leadInitials(nextLead.fullName)}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold text-slate-900">{nextLead.fullName}</p>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${TEMP_COLORS[nextLead.temperature]}`}>
                        {intentBadge(nextLead.temperature, nextLead.score)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{nextLead.mobile || nextLead.email || '—'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {nextLead.lastCourseTitle || 'General inquiry'} ·{' '}
                      {SOURCE_LABEL[nextLead.lastSource || ''] || 'Training interest'}
                    </p>
                  </div>
                </div>
                {formatNextAction(nextLead).urgent && (
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
                    SLA {formatNextAction(nextLead).text.replace(/[^\d]/g, '') || '15'} min
                  </span>
                )}
              </div>
              <div className="mt-4 rounded-lg bg-sky-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-sky-100">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600">Suggested opening</p>
                <p className="mt-1">
                  Hi {nextLead.fullName.split(' ')[0]}, I&apos;m calling from XpertIntern about the{' '}
                  {nextLead.lastCourseTitle || 'training program'} you showed interest in. Do you have two minutes?
                </p>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerId(nextLead.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4" /> View details
                </button>
                <button
                  type="button"
                  onClick={() => setCallLead(nextLead)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45]"
                >
                  <Phone className="h-4 w-4" /> Call via TeleCMI
                </button>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No leads in your queue yet.</p>
          )}
        </div>

        <div className="lc-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="lc-card-title">Daily progress</h3>
              <p className="text-xs text-slate-500">Target resets at 9:00 AM</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div
              className="lc-agent-donut"
              style={{ background: `conic-gradient(#2563eb ${callPct}%, #e2e8f0 0)` }}
              aria-hidden
            >
              <div className="lc-agent-donut-inner">
                <p className="text-xl font-bold text-slate-900">{callPct}%</p>
                <p className="text-[10px] text-slate-500">{callsToday} of {CALL_TARGET}</p>
              </div>
            </div>
            <ul className="w-full space-y-2.5">
              {progressRows.map((row) => (
                <li key={row.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">{row.label}</span>
                    <span className="font-semibold text-slate-900">
                      {row.value} <span className="font-normal text-slate-400">({row.pct}%)</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="lc-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div>
            <h3 className="lc-card-title">My call queue</h3>
            <p className="text-xs text-slate-500">Assigned leads in recommended order</p>
          </div>
          <Link to="/admin/leads/inbox" className="text-xs font-semibold text-[#2563eb] hover:underline">
            View all assigned
          </Link>
        </div>
        <ul className="divide-y divide-gray-100">
          {queue.length === 0 ? (
            <li className="py-10 text-center text-sm text-slate-500">Your queue is empty.</li>
          ) : (
            queue.map((lead, idx) => {
              const next = formatNextAction(lead)
              return (
                <li key={lead.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50/80">
                  <span className="w-6 text-center text-sm font-bold text-slate-400">{idx + 1}</span>
                  <span className="lc-avatar">{leadInitials(lead.fullName)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{lead.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {lead.lastCourseTitle || 'Inquiry'} · {LIFECYCLE_LABEL[lead.lifecycleStage] || lead.lifecycleStage}
                    </p>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${TEMP_COLORS[lead.temperature]}`}>
                    {intentBadge(lead.temperature, lead.score)}
                  </span>
                  <p className={`text-xs font-semibold ${next.urgent ? 'text-red-600' : 'text-slate-600'}`}>{next.text}</p>
                  <button
                    type="button"
                    onClick={() => setCallLead(lead)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#2563eb]/30 text-[#2563eb] hover:bg-[#2563eb]/5"
                    aria-label={`Call ${lead.fullName}`}
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>

      {drawerId && <LeadDetailDrawer leadId={drawerId} onClose={() => setDrawerId('')} />}
      <CallLeadModal open={!!callLead} lead={callLead} onClose={() => setCallLead(null)} />
    </div>
  )
}
