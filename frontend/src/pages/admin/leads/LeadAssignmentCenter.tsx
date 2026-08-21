import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Shuffle, Users } from 'lucide-react'
import { crmService, type CrmLead } from '@/services/crmService'
import { useLeadCommand } from './LeadCommandContext'
import { AssignLeadsModal } from './AssignLeadsModal'
import {
  SOURCE_LABEL,
  TEMP_COLORS,
  leadInitials,
} from './shared'

type AgentRow = { id: string; fullName: string; activeLeads: number; callsToday: number; capacityPct: number }

function waitingMin(lead: CrmLead): number {
  const t = lead.createdAt || lead.lastEventAt
  if (!t) return 0
  return Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000))
}

function intentLabel(temp: string, score: number) {
  return `${temp.charAt(0).toUpperCase() + temp.slice(1)} · ${score}`
}

const ROUTING_RULES = [
  { title: 'Payment recovery', desc: 'Score above 70 → Riya & Priya', active: true },
  { title: 'Technical training', desc: 'Python, AutoCAD → Tech team', active: true },
  { title: 'Other campaign leads', desc: 'Lowest workload agent', active: true },
]

const PAGE_SIZE = 10

function formatWaiting(min: number): string {
  if (min < 60) return `${min} min`
  if (min < 1440) return `${Math.round(min / 60)} hr`
  const days = Math.round(min / 1440)
  return days === 1 ? '1 day' : `${days} days`
}

export function LeadAssignmentCenter() {
  const { summary } = useLeadCommand()
  const [unassigned, setUnassigned] = useState<CrmLead[]>([])
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'hot' | 'payment'>('all')
  const [page, setPage] = useState(1)
  const [assignIds, setAssignIds] = useState<string[]>([])
  const [assignOpen, setAssignOpen] = useState(false)

  const load = () => {
    Promise.all([
      crmService.listLeads({ assignedTo: 'unassigned', limit: 100 }),
      crmService.getOverviewExtras(),
    ]).then(([leads, extras]) => {
      setUnassigned(leads.items)
      setAgents(extras.agentWorkload || [])
    })
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [filter])

  const filtered = useMemo(() => {
    let rows = [...unassigned].sort((a, b) => waitingMin(b) - waitingMin(a))
    if (filter === 'hot') rows = rows.filter((l) => l.temperature === 'hot')
    if (filter === 'payment') rows = rows.filter((l) => l.lastEventType?.startsWith('payment.'))
    return rows
  }, [unassigned, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0
  const pageEnd = Math.min(page * PAGE_SIZE, filtered.length)

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id))

  const togglePageSelection = () => {
    if (allPageSelected) {
      const pageIds = new Set(pageRows.map((r) => r.id))
      setSelected((s) => s.filter((id) => !pageIds.has(id)))
    } else {
      setSelected([...new Set([...selected, ...pageRows.map((r) => r.id)])])
    }
  }

  const recommendAgent = (lead: CrmLead): AgentRow | undefined => {
    if (!agents.length) return undefined
    const hot = lead.temperature === 'hot'
    const sorted = [...agents].sort((a, b) => a.activeLeads - b.activeLeads)
    return hot ? sorted[0] : sorted[Math.min(1, sorted.length - 1)]
  }

  const openAssign = (ids: string[]) => {
    setAssignIds(ids)
    setAssignOpen(true)
  }

  const workloadLabel = (pct: number) => {
    if (pct >= 70) return { text: 'High', class: 'text-red-600' }
    if (pct >= 40) return { text: 'Balanced', class: 'text-amber-600' }
    return { text: 'Available', class: 'text-emerald-600' }
  }

  const agentStatus = (a: AgentRow) => {
    if (a.callsToday > 0) return 'On call'
    if (a.capacityPct >= 70) return 'Busy'
    if (a.capacityPct >= 40) return 'Break'
    return 'Available'
  }

  return (
    <div className="space-y-5">
      <div className="lc-kpi-row lc-kpi-row--3">
        <div className="lc-kpi-icon-card">
          <div className="lc-kpi-icon lc-kpi-icon--red"><Users className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Unassigned leads</p>
            <p className="text-2xl font-bold text-slate-900">{summary?.unassigned ?? unassigned.length}</p>
            <p className="text-xs text-slate-500">{filtered.length} urgent shown</p>
          </div>
        </div>
        <div className="lc-kpi-icon-card">
          <div className="lc-kpi-icon lc-kpi-icon--blue"><Shuffle className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Assigned today</p>
            <p className="text-2xl font-bold text-slate-900">{summary?.newToday ?? '—'}</p>
            <p className="text-xs text-slate-500">Manual + automatic</p>
          </div>
        </div>
        <div className="lc-kpi-icon-card">
          <div className="lc-kpi-icon lc-kpi-icon--green"><CheckCircle2 className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Average time to assign</p>
            <p className="text-2xl font-bold text-slate-900">14 min</p>
            <p className="text-xs text-slate-500">Target: under 20 min</p>
          </div>
        </div>
      </div>

      <div className="lc-card lc-assignment-panel overflow-hidden">
        <div className="lc-card-head flex-wrap gap-2 border-b border-gray-100">
          <div>
            <h3 className="lc-card-title">Leads waiting for assignment</h3>
            <p className="text-xs text-slate-500">
              {filtered.length
                ? `Showing ${pageStart}–${pageEnd} of ${filtered.length} urgent leads · Select leads and choose an agent`
                : 'No urgent leads in this filter'}
            </p>
          </div>
          {selected.length > 0 && (
            <span className="rounded-full bg-[#1e3a5f]/10 px-3 py-1 text-xs font-semibold text-[#1e3a5f]">
              {selected.length} selected
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3 bg-slate-50/50">
          {(['all', 'hot', 'payment'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === f ? 'bg-[#1e3a5f] text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-gray-200 hover:bg-slate-50'}`}
            >
              {f === 'all' ? 'All urgent' : f === 'hot' ? 'Hot leads' : 'Payment recovery'}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="lc-table lc-assignment-table min-w-full">
            <thead>
              <tr>
                <th className="lc-assignment-col-check">
                  <input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} aria-label="Select all on this page" />
                </th>
                <th className="lc-assignment-col-lead">Lead</th>
                <th className="lc-assignment-col-interest">Interest &amp; source</th>
                <th className="lc-assignment-col-intent">Intent</th>
                <th className="lc-assignment-col-wait">Waiting</th>
                <th className="lc-assignment-col-agent">Recommended agent</th>
                <th className="lc-assignment-col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-500">No unassigned leads</td></tr>
              ) : (
                pageRows.map((row) => {
                  const rec = recommendAgent(row)
                  const wait = waitingMin(row)
                  const waitLabel = formatWaiting(wait)
                  return (
                    <tr key={row.id}>
                      <td className="lc-assignment-col-check">
                        <input
                          type="checkbox"
                          checked={selected.includes(row.id)}
                          onChange={() => setSelected((s) => (s.includes(row.id) ? s.filter((x) => x !== row.id) : [...s, row.id]))}
                        />
                      </td>
                      <td className="lc-assignment-col-lead">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="lc-avatar">{leadInitials(row.fullName)}</span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{row.fullName}</p>
                            <p className="text-xs text-slate-500 truncate">{row.mobile}</p>
                          </div>
                        </div>
                      </td>
                      <td className="lc-assignment-col-interest">
                        <p className="font-medium text-slate-800 truncate">{row.lastCourseTitle || 'General'}</p>
                        <p className="text-xs text-slate-500 truncate">{SOURCE_LABEL[row.lastSource || ''] || row.lastEventType?.replace(/\./g, ' ') || '—'}</p>
                      </td>
                      <td className="lc-assignment-col-intent">
                        <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ring-1 ${TEMP_COLORS[row.temperature]}`}>
                          {intentLabel(row.temperature, row.score)}
                        </span>
                      </td>
                      <td className={`lc-assignment-col-wait whitespace-nowrap ${wait >= 30 ? 'font-semibold text-red-600' : 'text-slate-600'}`}>
                        {waitLabel}
                      </td>
                      <td className="lc-assignment-col-agent">
                        {rec ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="lc-avatar lc-avatar--sm">{leadInitials(rec.fullName)}</span>
                            <span className="text-sm truncate">{rec.fullName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="lc-assignment-col-action">
                        <button type="button" onClick={() => openAssign([row.id])} className="lc-assign-btn">Assign</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="lc-assignment-pagination">
            <p className="text-xs text-slate-500">
              Showing {pageStart}–{pageEnd} of {filtered.length} leads · {PAGE_SIZE} per page
            </p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="lc-page-btn" aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium text-slate-700 min-w-[5.5rem] text-center">
                Page {page} / {totalPages}
              </span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="lc-page-btn" aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="lc-card p-4">
        <div className="mb-4">
          <h3 className="lc-card-title">Agent capacity</h3>
          <p className="text-xs text-slate-500">Select leads above, then choose who will call</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {agents.map((a) => {
            const wl = workloadLabel(a.capacityPct)
            return (
              <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="lc-avatar">{leadInitials(a.fullName)}</span>
                    <div>
                      <p className="font-semibold text-sm">{a.fullName}</p>
                      <p className="text-xs text-slate-500">{agentStatus(a)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1 text-center text-xs">
                  <div><p className="font-bold text-slate-900">{a.activeLeads}</p><p className="text-slate-400">Active</p></div>
                  <div><p className="font-bold text-slate-900">{a.callsToday}</p><p className="text-slate-400">Calls</p></div>
                  <div><p className="font-bold text-slate-900">—</p><p className="text-slate-400">Conv.</p></div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${a.capacityPct}%` }} /></div>
                <p className={`mt-1 text-[10px] font-semibold ${wl.class}`}>{wl.text}</p>
                <button
                  type="button"
                  disabled={!selected.length}
                  onClick={() => openAssign(selected)}
                  className="mt-3 w-full rounded-lg bg-[#1e3a5f] py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Assign selected
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="lc-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="lc-card-title">Routing rules</h3>
          <button type="button" className="text-xs font-semibold text-[#2563eb]">+ New rule</button>
        </div>
        <ul className="divide-y divide-gray-100">
          {ROUTING_RULES.map((r) => (
            <li key={r.title} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold text-sm text-slate-900">{r.title}</p>
                <p className="text-xs text-slate-500">{r.desc}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
            </li>
          ))}
        </ul>
      </div>

      <AssignLeadsModal open={assignOpen} leadIds={assignIds} onClose={() => { setAssignOpen(false); setAssignIds([]) }} onAssigned={() => { setSelected([]); load() }} />
    </div>
  )
}
