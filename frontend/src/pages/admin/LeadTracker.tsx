import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Phone,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  crmService,
  CRM_VIEWS,
  LIFECYCLE_OPTIONS,
  type CrmAgent,
  type CrmLead,
  type CrmSummary,
} from '@/services/crmService'

const PAGE_SIZES = [10, 20, 50]

const TEMP_COLORS: Record<string, string> = {
  hot: 'bg-red-50 text-red-700 ring-red-200',
  warm: 'bg-amber-50 text-amber-800 ring-amber-200',
  cold: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const LIFECYCLE_LABEL: Record<string, string> = {
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

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${accent || 'text-brand-navy'}`}>{value}</p>
    </div>
  )
}

export function LeadTracker() {
  const [view, setView] = useState('')
  const [tab, setTab] = useState<'inbox' | 'myday'>('inbox')
  const [items, setItems] = useState<CrmLead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState<CrmSummary | null>(null)
  const [agents, setAgents] = useState<CrmAgent[]>([])
  const [myDay, setMyDay] = useState<{ followUps: CrmLead[]; newAssigned: CrmLead[]; hotUncontacted: CrmLead[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lifecycle, setLifecycle] = useState('')
  const [temperature, setTemperature] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [followUpDue, setFollowUpDue] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [assignAgentId, setAssignAgentId] = useState('')
  const [assignMode, setAssignMode] = useState<'single' | 'round_robin'>('single')
  const [assigning, setAssigning] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, sumRes, agentList] = await Promise.all([
        crmService.listLeads({
          view: view || undefined,
          q: search || undefined,
          lifecycle: lifecycle || undefined,
          temperature: temperature || undefined,
          assignedTo: assignedFilter || undefined,
          followUpDue,
          page,
          limit: pageSize,
        }),
        crmService.getSummary(),
        crmService.listAgents().catch(() => []),
      ])
      setItems(listRes.items)
      setTotal(listRes.total)
      setPage(listRes.page)
      setTotalPages(listRes.totalPages)
      setSummary(sumRes)
      setAgents(agentList)
      if (tab === 'myday') {
        setMyDay(await crmService.getMyDay())
      }
    } catch {
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [view, search, lifecycle, temperature, assignedFilter, followUpDue, page, pageSize, tab])

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  useEffect(() => {
    setPage(1)
    setSelected([])
  }, [view, lifecycle, temperature, assignedFilter, followUpDue, pageSize])

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (selected.length === items.length) setSelected([])
    else setSelected(items.map((i) => i.id))
  }

  const handleAssignSelected = async () => {
    if (!selected.length || assigning) return
    setAssigning(true)
    try {
      if (assignMode === 'round_robin') {
        await crmService.roundRobinAssign(selected, assignAgentId ? [assignAgentId] : undefined)
      } else {
        if (!assignAgentId) {
          alert('Select an agent for bulk assign')
          return
        }
        await crmService.bulkAssign(selected, assignAgentId)
      }
      setSelected([])
      load()
    } catch {
      alert('Assignment failed')
    } finally {
      setAssigning(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await crmService.exportLeads({
        view: view || undefined,
        q: search || undefined,
        lifecycle: lifecycle || undefined,
        temperature: temperature || undefined,
        assignedTo: assignedFilter || undefined,
        followUpDue,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'leads-export.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const viewCount = (key: string | null) => {
    if (!key || !summary?.viewCounts) return null
    return summary.viewCounts[key] ?? 0
  }

  const myDaySections = myDay
    ? [
        { title: 'Follow-ups due', rows: myDay.followUps, icon: Phone, color: 'border-l-red-500' },
        { title: 'Newly assigned', rows: myDay.newAssigned, icon: UserPlus, color: 'border-l-blue-500' },
        { title: 'Hot — not contacted', rows: myDay.hotUncontacted, icon: RefreshCw, color: 'border-l-amber-500' },
      ]
    : []

  return (
    <div className="space-y-5 w-full max-w-[1400px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-navy">Lead CRM</h2>
          <p className="mt-0.5 text-sm text-slate-gray">Unified inbox · assignment · follow-ups</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button type="button" onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label="Open" value={summary.totalOpen} />
          <SummaryCard label="Unassigned" value={summary.unassigned} accent="text-amber-600" />
          <SummaryCard label="Hot" value={summary.hot} accent="text-red-600" />
          <SummaryCard label="Follow-ups due" value={summary.followUpsDue} />
          <SummaryCard label="New today" value={summary.newToday} />
          <SummaryCard label="Enrolled" value={summary.enrolled} accent="text-emerald-600" />
        </div>
      )}

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(['inbox', 'myday'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === t ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t === 'inbox' ? 'Inbox' : 'My Day'}
          </button>
        ))}
      </div>

      {tab === 'inbox' && (
        <>
          <div className="flex flex-wrap gap-2">
            {CRM_VIEWS.map((v) => {
              const count = v.countKey ? viewCount(v.countKey) : summary?.totalOpen
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    view === v.id ? 'bg-brand-navy text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {v.label}
                  {count != null && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${view === v.id ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <input
              type="search"
              placeholder="Search name, mobile, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[200px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
            <select value={lifecycle} onChange={(e) => setLifecycle(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
              {LIFECYCLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select value={temperature} onChange={(e) => setTemperature(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
              <option value="">All temperatures</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
            <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
              <option value="">All owners</option>
              <option value="unassigned">Unassigned only</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.fullName}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={followUpDue} onChange={(e) => setFollowUpDue(e.target.checked)} className="rounded border-gray-300" />
              Follow-ups due
            </label>
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-accent/30 bg-brand-accent/5 px-4 py-3">
              <span className="text-sm font-medium text-brand-navy">{selected.length} selected</span>
              <select value={assignMode} onChange={(e) => setAssignMode(e.target.value as 'single' | 'round_robin')} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">
                <option value="single">Assign all to one agent</option>
                <option value="round_robin">Round-robin distribute</option>
              </select>
              {assignMode === 'single' && (
                <select value={assignAgentId} onChange={(e) => setAssignAgentId(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm min-w-[160px]">
                  <option value="">Choose agent…</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.fullName}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={handleAssignSelected}
                disabled={assigning || (assignMode === 'single' && !assignAgentId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Users className="h-4 w-4" /> {assigning ? 'Assigning…' : 'Assign selected'}
              </button>
              <button type="button" onClick={() => setSelected([])} className="text-sm text-gray-500 hover:text-gray-800">Clear</button>
            </div>
          )}
        </>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-gray">Loading leads…</div>
        ) : tab === 'myday' ? (
          <div className="grid gap-4 p-4 md:grid-cols-3">
            {myDaySections.map(({ title, rows, icon: Icon, color }) => (
              <div key={title} className={`rounded-lg border border-gray-100 border-l-4 ${color} bg-gray-50/50 p-4`}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy">
                  <Icon className="h-4 w-4" /> {title}
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-600 ring-1 ring-gray-200">{rows.length}</span>
                </h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-400">Nothing here</p>
                ) : (
                  <ul className="space-y-2">
                    {rows.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-100">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-brand-navy">{r.fullName}</p>
                          <p className="truncate text-xs text-gray-500">{r.mobile || r.email}</p>
                        </div>
                        <Link to={`/admin/leads/${r.id}`} className="shrink-0 text-xs font-semibold text-brand-accent hover:underline">Open</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-gray">No leads match your filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={selected.length === items.length && items.length > 0} onChange={toggleSelectAll} aria-label="Select all" />
                    </th>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Last event</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-navy">{row.fullName}</p>
                        <p className="text-xs text-gray-500">{row.mobile || row.email || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${TEMP_COLORS[row.temperature] || TEMP_COLORS.cold}`}>
                          {row.temperature} · {row.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{LIFECYCLE_LABEL[row.lifecycleStage] || row.lifecycleStage}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{row.lastEventType?.replace(/\./g, ' ') || '—'}</td>
                      <td className="px-4 py-3">
                        {row.assignedToName ? (
                          <span className="text-gray-700">{row.assignedToName}</span>
                        ) : (
                          <span className="text-amber-600 font-medium">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {row.lastEventAt ? new Date(row.lastEventAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/leads/${row.id}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-accent" title="View lead">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} leads
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700">
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>{s} / page</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[80px] text-center text-xs font-medium text-gray-700">Page {page} / {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
