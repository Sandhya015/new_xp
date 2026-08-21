import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Phone,
} from 'lucide-react'
import { crmService, type CrmLead } from '@/services/crmService'
import { useLeadCommand } from './LeadCommandContext'
import { CallLeadModal } from './CallLeadModal'
import {
  formatNextAction,
  leadCategoryLine,
  leadInitials,
  TEMP_COLORS,
} from './shared'

type AgentRow = {
  id: string
  fullName: string
  activeLeads: number
  callsToday: number
  capacityPct: number
}

const ACTION_QUEUE = [
  { key: 'hot', title: 'Hot leads without an owner', sub: 'Assign within 15 minutes', link: '/admin/leads/assignment' },
  { key: 'followups', title: 'Overdue team follow-ups', sub: 'Critical: review overdue callbacks', link: '/admin/leads/follow-ups' },
  { key: 'payment', title: 'Payment recovery leads', sub: 'High-value recovery queue', link: '/admin/leads/inbox?view=payment_recovery' },
  { key: 'capacity', title: 'Agents near capacity', sub: 'Redistribute new work', link: '/admin/leads/my-agents' },
]

export function ManagerOverview() {
  const { summary, refresh } = useLeadCommand()
  const [priority, setPriority] = useState<CrmLead[]>([])
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [callLead, setCallLead] = useState<CrmLead | null>(null)

  useEffect(() => {
    void refresh()
    crmService.listLeads({ limit: 8, temperature: 'hot' }).then((r) => setPriority(r.items)).catch(() => setPriority([]))
    crmService.getOverviewExtras().then((r) => setAgents(r.agentWorkload || [])).catch(() => setAgents([]))
  }, [refresh])

  const s = summary
  const urgentCount = (s?.followUpsDue ?? 0) + Math.min(s?.unassigned ?? 0, 9)
  const teamCalls = agents.reduce((n, a) => n + a.callsToday, 0)
  const connectedEst = Math.round(teamCalls * 0.76)
  const nearCapacity = agents.filter((a) => a.capacityPct >= 70).length

  const queueCounts: Record<string, number> = {
    hot: s?.hot ?? 0,
    followups: s?.followUpsDue ?? 0,
    payment: s?.viewCounts?.payment_recovery ?? 0,
    capacity: nearCapacity,
  }

  return (
    <div className="space-y-5">
      {urgentCount > 0 && (
        <div className="lc-manager-urgent-banner">
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-sm font-medium text-white">
              Your team has <strong>{urgentCount}</strong> urgent actions. Prioritize unassigned hot leads and overdue payment follow-ups first.
            </p>
          </div>
          <Link to="/admin/leads/assignment" className="lc-manager-urgent-btn">
            Open assignment queue
          </Link>
        </div>
      )}

      <div className="lc-kpi-row">
        {[
          { label: 'Team leads today', value: s?.newToday ?? 0, delta: 'Today' },
          { label: 'Unassigned', value: s?.unassigned ?? 0, delta: `${s?.hot ?? 0} hot leads`, warn: true },
          { label: 'Calls connected', value: connectedEst, delta: teamCalls ? `${Math.round((connectedEst / Math.max(teamCalls, 1)) * 100)}%` : '—' },
          { label: 'Team conversion', value: '—', delta: 'Connect CRM data' },
        ].map((row) => (
          <div key={row.label} className="lc-stat">
            <p className="lc-stat-label">{row.label}</p>
            <p className="lc-stat-value">{row.value}</p>
            <p className={`mt-1 text-xs font-medium ${row.warn ? 'text-red-600' : 'text-emerald-600'}`}>{row.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lc-card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="lc-card-title">Manager action queue</h3>
              <p className="text-xs text-slate-500">Work requiring assignment or intervention</p>
            </div>
            <Link to="/admin/leads/inbox" className="text-xs font-semibold text-[#2563eb]">View all</Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {ACTION_QUEUE.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {queueCounts[item.key] ?? 0} {item.title}
                  </p>
                  <p className="text-xs text-slate-500">{item.sub}</p>
                </div>
                <Link to={item.link} className="shrink-0 text-xs font-semibold text-[#2563eb] hover:underline">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lc-card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="lc-card-title">Team live status</h3>
              <p className="text-xs text-slate-500">Availability and current workload</p>
            </div>
            <Link to="/admin/leads/my-agents" className="text-xs font-semibold text-[#2563eb]">Manage agents</Link>
          </div>
          <ul className="space-y-3">
            {agents.length === 0 ? (
              <li className="text-sm text-slate-500 py-4 text-center">No agents yet</li>
            ) : (
              agents.map((a) => {
                const onCall = a.callsToday > 0
                const busy = a.capacityPct >= 70
                const status = onCall ? 'On call' : busy ? 'Busy' : 'Available'
                const dot = onCall ? 'bg-blue-500' : busy ? 'bg-amber-500' : 'bg-emerald-500'
                return (
                  <li key={a.id} className="flex items-center gap-3">
                    <span className="lc-avatar">{leadInitials(a.fullName)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{a.fullName}</p>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                        <span>{a.activeLeads} active</span>
                        <span>{a.callsToday} calls</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${a.capacityPct}%` }} />
                      </div>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      </div>

      <div className="lc-card overflow-hidden">
        <div className="lc-card-head flex-wrap gap-2">
          <div>
            <h3 className="lc-card-title">Team priority leads</h3>
            <p className="text-xs text-slate-500">Sorted by intent score and SLA</p>
          </div>
          <Link to="/admin/leads/inbox" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
            Open team inbox <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="lc-table min-w-full">
            <thead>
              <tr>
                <th className="pl-4">Lead</th>
                <th>Interest</th>
                <th>Intent</th>
                <th>Assigned to</th>
                <th>Next action</th>
                <th className="pr-4" />
              </tr>
            </thead>
            <tbody>
              {priority.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500">No priority leads</td></tr>
              ) : (
                priority.map((row) => (
                  <tr key={row.id}>
                    <td className="pl-4">
                      <div className="flex items-center gap-2">
                        <span className="lc-avatar">{leadInitials(row.fullName)}</span>
                        <div>
                          <p className="font-semibold">{row.fullName}</p>
                          <p className="text-xs text-slate-500">{row.mobile}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">{leadCategoryLine(row)}</td>
                    <td>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ring-1 capitalize ${TEMP_COLORS[row.temperature]}`}>
                        {row.temperature} · {row.score}
                      </span>
                    </td>
                    <td className="text-sm">{row.assignedToName || <span className="text-[#2563eb]">Unassigned</span>}</td>
                    <td className="text-sm">{formatNextAction(row).text}</td>
                    <td className="pr-4">
                      <button type="button" onClick={() => setCallLead(row)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2563eb]/25 text-[#2563eb]">
                        <Phone className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CallLeadModal open={!!callLead} lead={callLead} onClose={() => setCallLead(null)} />
    </div>
  )
}
