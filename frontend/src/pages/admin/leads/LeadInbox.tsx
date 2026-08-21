import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Eye, Phone, Search, UserPlus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { isLeadAgentOnly } from '@/constants/adminAccess'
import { AgentAssignedLeads } from './AgentAssignedLeads'
import {
  crmService,
  CRM_VIEWS,
  LIFECYCLE_OPTIONS,
  type CrmLead,
} from '@/services/crmService'
import { useLeadCommand } from './LeadCommandContext'
import { LeadDetailDrawer } from './LeadDetailDrawer'
import { AssignLeadsModal } from './AssignLeadsModal'
import { CallLeadModal } from './CallLeadModal'
import {
  LIFECYCLE_LABEL,
  SOURCE_LABEL,
  STAGE_COLORS,
  TEMP_COLORS,
  formatNextAction,
  leadInitials,
} from './shared'

const PAGE_SIZES = [10, 20, 50]

function viewTabCount(viewId: string, countKey: string | null, summary: ReturnType<typeof useLeadCommand>['summary']) {
  if (!summary) return null
  if (!viewId) return summary.totalOpen
  if (viewId === 'contact_us') {
    return (summary.viewCounts?.contact_us ?? 0) + (summary.viewCounts?.callback ?? 0)
  }
  if (countKey) return summary.viewCounts?.[countKey] ?? 0
  return null
}

function intentLabel(temp: string, score: number) {
  const t = temp.charAt(0).toUpperCase() + temp.slice(1)
  return `${t} · ${score}`
}

export function LeadInbox() {
  const user = useAuthStore((s) => s.user)
  if (isLeadAgentOnly(user)) {
    return <AgentAssignedLeads />
  }
  return <LeadInboxAdmin />
}

function LeadInboxAdmin() {
  const { summary, refresh } = useLeadCommand()
  const [params, setParams] = useSearchParams()
  const drawerLeadId = params.get('lead') || ''

  const [view, setView] = useState(params.get('view') || '')
  const [items, setItems] = useState<CrmLead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lifecycle, setLifecycle] = useState('')
  const assignedFilter = params.get('filter') === 'unassigned' ? 'unassigned' : ''
  const [selected, setSelected] = useState<string[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignLeadIds, setAssignLeadIds] = useState<string[]>([])
  const [callLead, setCallLead] = useState<CrmLead | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const listRes = await crmService.listLeads({
        view: view || undefined,
        q: search || undefined,
        lifecycle: lifecycle || undefined,
        assignedTo: assignedFilter || undefined,
        page,
        limit: pageSize,
      })
      setItems(listRes.items)
      setTotal(listRes.total)
      setTotalPages(listRes.totalPages)
      void refresh()
    } finally {
      setLoading(false)
    }
  }, [view, search, lifecycle, assignedFilter, page, pageSize, refresh])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [view, lifecycle, assignedFilter, pageSize, search])

  const openDrawer = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('lead', id)
    setParams(next)
  }

  const closeDrawer = () => {
    const next = new URLSearchParams(params)
    next.delete('lead')
    setParams(next)
  }

  const openAssign = (ids: string[]) => {
    setAssignLeadIds(ids)
    setAssignOpen(true)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await crmService.exportLeads({
        view: view || undefined,
        lifecycle: lifecycle || undefined,
        assignedTo: assignedFilter || undefined,
        q: search || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'lead-inbox.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const onAssigned = () => {
    setSelected([])
    void load()
  }

  const toggleAll = () => {
    setSelected(selected.length === items.length ? [] : items.map((i) => i.id))
  }

  return (
    <div className="space-y-4">
      {/* Source filter tabs — horizontal scroll */}
      <div className="lc-inbox-tabs-wrap">
        <div className="lc-inbox-tabs">
          {CRM_VIEWS.map((v) => {
            const count = viewTabCount(v.id, v.countKey, summary)
            const active = view === v.id
            return (
              <button
                key={v.id || 'all'}
                type="button"
                onClick={() => setView(v.id)}
                className={`lc-inbox-tab${active ? ' lc-inbox-tab--active' : ''}`}
              >
                {v.label}
                {count != null && <span className="lc-inbox-tab-count">({count})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Toolbar + table */}
      <div className="lc-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search name, phone or training…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>
          <select
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-700 min-w-[130px]"
          >
            {LIFECYCLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              type="button"
              onClick={() => openAssign(selected.length ? selected : [])}
              disabled={!selected.length}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-40"
            >
              <UserPlus className="h-4 w-4" /> Assign leads
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading leads…</p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No leads match your filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="lc-table min-w-full">
                <thead>
                  <tr>
                    <th className="w-10 pl-4">
                      <input type="checkbox" checked={selected.length === items.length && items.length > 0} onChange={toggleAll} aria-label="Select all" />
                    </th>
                    <th>Lead</th>
                    <th>Interest &amp; source</th>
                    <th>Intent</th>
                    <th>Stage</th>
                    <th>Assigned to</th>
                    <th>Next action</th>
                    <th className="pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const next = formatNextAction(row)
                    const stageKey = row.lifecycleStage || 'new'
                    const stageClass = STAGE_COLORS[stageKey] || STAGE_COLORS.new
                    return (
                      <tr key={row.id}>
                        <td className="pl-4">
                          <input
                            type="checkbox"
                            checked={selected.includes(row.id)}
                            onChange={() =>
                              setSelected((s) => (s.includes(row.id) ? s.filter((x) => x !== row.id) : [...s, row.id]))
                            }
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="lc-avatar">{leadInitials(row.fullName)}</span>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">{row.fullName}</p>
                              <p className="text-xs text-slate-500">{row.mobile || row.email || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="font-medium text-slate-800">{row.lastCourseTitle || 'General inquiry'}</p>
                          <p className="text-xs text-slate-500">
                            {SOURCE_LABEL[row.lastSource || ''] || row.lastEventType?.replace(/\./g, ' ') || '—'}
                          </p>
                        </td>
                        <td>
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ring-1 ${TEMP_COLORS[row.temperature]}`}>
                            {intentLabel(row.temperature, row.score)}
                          </span>
                        </td>
                        <td>
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${stageClass}`}>
                            {LIFECYCLE_LABEL[stageKey] || stageKey.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          {row.assignedToName ? (
                            <span className="text-sm text-slate-800">{row.assignedToName}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAssign([row.id])}
                              className="text-sm font-semibold text-[#2563eb] hover:underline"
                            >
                              + Assign
                            </button>
                          )}
                        </td>
                        <td className={next.urgent ? 'text-sm font-semibold text-red-600' : 'text-sm text-slate-600'}>
                          {next.text}
                        </td>
                        <td className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setCallLead(row)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2563eb]/25 text-[#2563eb] hover:bg-[#2563eb]/5"
                              title="Call"
                            >
                              <Phone className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDrawer(row.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#2563eb]"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} leads
              </p>
              <div className="flex items-center gap-2">
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded border border-gray-200 px-2 py-1 text-xs">
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>{s} / page</option>
                  ))}
                </select>
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border p-1 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-medium">Page {page} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border p-1 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {drawerLeadId && <LeadDetailDrawer leadId={drawerLeadId} onClose={closeDrawer} onUpdated={load} />}

      <AssignLeadsModal
        open={assignOpen && assignLeadIds.length > 0}
        leadIds={assignLeadIds}
        onClose={() => {
          setAssignOpen(false)
          setAssignLeadIds([])
        }}
        onAssigned={onAssigned}
      />

      <CallLeadModal
        open={!!callLead}
        lead={callLead}
        onClose={() => setCallLead(null)}
        onCalled={load}
      />
    </div>
  )
}
