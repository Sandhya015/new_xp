import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Phone,
  Upload,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { crmService, type CrmAgent, type CrmLead } from '@/services/crmService'
import { useLeadCommand } from './LeadCommandContext'
import { CallLeadModal } from './CallLeadModal'
import {
  formatNextAction,
  leadCategoryLine,
  leadInitials,
  leadShortId,
  SOURCE_LABEL,
  TEMP_COLORS,
} from './shared'

type AgentRow = CrmAgent & { activeLeads: number; callsToday: number; capacityPct: number }
type ActivityRow = {
  id: string
  eventType: string
  source: string
  leadId: string | null
  leadName: string
  createdAt: string | null
  payload: Record<string, unknown>
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.round(hrs / 24)} d ago`
}

function activityMessage(a: ActivityRow): { icon: typeof CheckCircle2; text: string; tone: string } {
  const t = a.eventType || ''
  const name = a.leadName
  if (t === 'manual.entry' || t === 'manual.upload') {
    return { icon: UserPlus, text: `New lead added — ${name}`, tone: 'text-blue-600' }
  }
  if (t.startsWith('call.')) {
    const dur = a.payload.durationSec ? ` (${a.payload.durationSec}s)` : ''
    return { icon: Phone, text: `Call logged for ${name}${dur}`, tone: 'text-emerald-600' }
  }
  if (t.startsWith('payment.')) {
    return { icon: Wallet, text: `Payment event — ${name}`, tone: 'text-violet-600' }
  }
  if (t.includes('assign')) {
    return { icon: UserPlus, text: `Lead assigned — ${name}`, tone: 'text-blue-600' }
  }
  if (t.includes('import') || t.includes('upload')) {
    return { icon: Upload, text: `Data imported — ${name}`, tone: 'text-slate-600' }
  }
  if (t.includes('enroll') || t.includes('converted')) {
    return { icon: BarChart3, text: `Lead converted — ${name}`, tone: 'text-emerald-600' }
  }
  const label = t.replace(/\./g, ' ')
  return { icon: CheckCircle2, text: `${label} — ${name}`, tone: 'text-slate-600' }
}

function agentStatus(callsToday: number, activeLeads: number): { label: string; dot: string } {
  if (callsToday > 0) return { label: 'On call', dot: 'bg-blue-500' }
  if (activeLeads > 25) return { label: 'Busy', dot: 'bg-amber-500' }
  return { label: 'Available', dot: 'bg-emerald-500' }
}

export function LeadOverview() {
  const { summary, refresh } = useLeadCommand()
  const [priority, setPriority] = useState<CrmLead[]>([])
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [callLead, setCallLead] = useState<CrmLead | null>(null)

  useEffect(() => {
    void refresh()
    crmService.listLeads({ limit: 6, temperature: 'hot' }).then((r) => setPriority(r.items)).catch(() => setPriority([]))
    crmService.getOverviewExtras().then((r) => {
      setAgents(r.agentWorkload || [])
      setActivity(r.recentActivity || [])
    }).catch(() => {
      setAgents([])
      setActivity([])
    })
  }, [refresh])

  const s = summary

  return (
    <div className="space-y-5">
      <div className="lc-kpi-row">
        <Link to="/admin/leads/inbox?filter=unassigned" className="lc-urgent-card hover:border-amber-300 transition">
          <span className="lc-urgent-card-label text-amber-700">Hot leads unassigned</span>
          <strong>{s?.hot ?? 0}</strong>
          <span className="lc-urgent-card-meta">Needs immediate assignment</span>
          <span className="lc-urgent-card-link">Review now <ArrowRight className="h-3 w-3" /></span>
        </Link>
        <Link to="/admin/leads/follow-ups" className="lc-urgent-card hover:border-red-300 transition">
          <span className="lc-urgent-card-label text-red-700">Follow-ups overdue</span>
          <strong>{s?.followUpsDue ?? 0}</strong>
          <span className="lc-urgent-card-meta">Callbacks past due time</span>
          <span className="lc-urgent-card-link">Review now <ArrowRight className="h-3 w-3" /></span>
        </Link>
        <Link to="/admin/leads/inbox?view=payment_recovery" className="lc-urgent-card hover:border-violet-300 transition">
          <span className="lc-urgent-card-label text-violet-700">
            <Wallet className="h-3 w-3 shrink-0" /> Payments need recovery
          </span>
          <strong>{s?.viewCounts?.payment_recovery ?? 0}</strong>
          <span className="lc-urgent-card-meta">Abandoned or failed checkout</span>
          <span className="lc-urgent-card-link">Review now <ArrowRight className="h-3 w-3" /></span>
        </Link>
        <Link to="/admin/leads/calls" className="lc-urgent-card hover:border-emerald-300 transition">
          <span className="lc-urgent-card-label text-emerald-700">
            <Phone className="h-3 w-3 shrink-0" /> TeleCMI
          </span>
          <strong>Live</strong>
          <span className="lc-urgent-card-meta">Click-to-call enabled</span>
          <span className="lc-urgent-card-link">Open calls <ArrowRight className="h-3 w-3" /></span>
        </Link>
      </div>

      <div className="lc-kpi-row">
        <div className="lc-stat"><p className="lc-stat-label">Open leads</p><p className="lc-stat-value">{s?.totalOpen ?? '—'}</p></div>
        <div className="lc-stat"><p className="lc-stat-label">Unassigned</p><p className="lc-stat-value text-amber-600">{s?.unassigned ?? '—'}</p></div>
        <div className="lc-stat"><p className="lc-stat-label">New today</p><p className="lc-stat-value">{s?.newToday ?? '—'}</p></div>
        <div className="lc-stat"><p className="lc-stat-label">Enrolled</p><p className="lc-stat-value text-emerald-600">{s?.enrolled ?? '—'}</p></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="lc-card xl:col-span-3">
          <div className="lc-card-head">
            <div>
              <h3 className="lc-card-title">Lead flow</h3>
              <p className="text-xs text-slate-500">Last 7 days by source view</p>
            </div>
            <Link to="/admin/leads/reports" className="text-xs font-semibold text-[#2563eb] hover:underline">View report</Link>
          </div>
          <div className="flex flex-wrap gap-4 p-4">
            {Object.entries(s?.viewCounts ?? {}).slice(0, 6).map(([key, val]) => (
              <div key={key} className="min-w-[100px] flex-1">
                <div className="mb-1 flex items-end justify-between text-xs">
                  <span className="font-medium text-slate-600">{SOURCE_LABEL[key] || key}</span>
                  <span className="font-bold text-slate-900">{val}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#3b82f6]" style={{ width: `${Math.min(100, (val / Math.max(s?.totalOpen || 1, 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="lc-card xl:col-span-2">
          <div className="lc-card-head">
            <div>
              <h3 className="lc-card-title">Live funnel</h3>
              <p className="text-xs text-slate-500">Pipeline snapshot</p>
            </div>
          </div>
          <ul className="space-y-3 p-4">
            {[
              { label: 'Open', val: s?.totalOpen ?? 0 },
              { label: 'Unassigned', val: s?.unassigned ?? 0 },
              { label: 'Hot', val: s?.hot ?? 0 },
              { label: 'Follow-ups due', val: s?.followUpsDue ?? 0 },
              { label: 'Enrolled', val: s?.enrolled ?? 0 },
            ].map((row) => (
              <li key={row.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-bold text-slate-900">{row.val}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#1e3a5f]" style={{ width: `${Math.min(100, (row.val / Math.max(s?.totalOpen || 1, 1)) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Priority leads — full width */}
      <div className="lc-card">
        <div className="lc-card-head">
          <div>
            <h3 className="lc-card-title">Priority leads</h3>
            <p className="text-xs text-slate-500">Ranked by intent, urgency and activity</p>
          </div>
          <Link to="/admin/leads/inbox" className="text-sm font-semibold text-[#2563eb] hover:underline">
            View all leads
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="lc-table min-w-full">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Interest &amp; stage</th>
                <th>Intent</th>
                <th>Assigned to</th>
                <th>Next action</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {priority.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500">No priority leads right now</td></tr>
              ) : (
                priority.map((row) => {
                  const next = formatNextAction(row)
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="lc-avatar">{leadInitials(row.fullName)}</span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{row.fullName}</p>
                            <p className="truncate text-xs text-slate-500">
                              {leadShortId(row.id)} · {row.lastCourseTitle || 'General inquiry'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-600 capitalize">{leadCategoryLine(row)}</td>
                      <td>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 capitalize ${TEMP_COLORS[row.temperature]}`}>
                          {row.temperature} · {row.score}
                        </span>
                      </td>
                      <td>
                        {row.assignedToName ? (
                          <span className="font-medium text-slate-800">{row.assignedToName}</span>
                        ) : (
                          <span className="font-semibold text-slate-500">Unassigned</span>
                        )}
                      </td>
                      <td className={next.urgent ? 'text-sm font-semibold text-red-600' : 'text-sm text-slate-600'}>
                        {next.text}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setCallLead(row)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2563eb]/30 text-[#2563eb] hover:bg-[#2563eb]/5"
                          title="Call lead"
                        >
                          <Phone className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent workload + Recent activity */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lc-card lg:col-span-3">
          <div className="lc-card-head">
            <div>
              <h3 className="lc-card-title">Agent workload</h3>
              <p className="text-xs text-slate-500">Live capacity and today&apos;s activity</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {agents.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">No agents configured yet</p>
            ) : (
              agents.map((a) => {
                const st = agentStatus(a.callsToday, a.activeLeads)
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                    <div className="flex min-w-[180px] flex-1 items-center gap-3">
                      <span className="lc-avatar">{leadInitials(a.fullName)}</span>
                      <div>
                        <p className="font-semibold text-slate-900">{a.fullName}</p>
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </p>
                      </div>
                    </div>
                    <div className="text-center min-w-[72px]">
                      <p className="text-lg font-bold text-slate-900">{a.activeLeads}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Active leads</p>
                    </div>
                    <div className="text-center min-w-[72px]">
                      <p className="text-lg font-bold text-slate-900">{a.callsToday}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Calls today</p>
                    </div>
                    <div className="min-w-[120px] flex-1">
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${a.capacityPct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="lc-card lg:col-span-2">
          <div className="lc-card-head">
            <div>
              <h3 className="lc-card-title">Recent activity</h3>
              <p className="text-xs text-slate-500">Live operational updates</p>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {activity.length === 0 ? (
              <li className="p-6 text-center text-sm text-slate-500">No recent activity</li>
            ) : (
              activity.map((a) => {
                const msg = activityMessage(a)
                const Icon = msg.icon
                return (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3.5">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 ${msg.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800 leading-snug">{msg.text}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{relativeTime(a.createdAt)}</p>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      </div>

      <CallLeadModal open={!!callLead} lead={callLead} onClose={() => setCallLead(null)} />
    </div>
  )
}
