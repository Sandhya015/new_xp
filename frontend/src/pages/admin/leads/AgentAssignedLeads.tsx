import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, Phone, Search } from 'lucide-react'
import { crmService, type CrmLead } from '@/services/crmService'
import { LeadDetailDrawer } from './LeadDetailDrawer'
import { CallLeadModal } from './CallLeadModal'
import {
  LIFECYCLE_LABEL,
  SOURCE_LABEL,
  STAGE_COLORS,
  TEMP_COLORS,
  formatNextAction,
  leadInitials,
} from './shared'

type FilterTab = 'all' | 'hot' | 'follow-up'

function intentLabel(temp: string, score: number) {
  return `${temp.charAt(0).toUpperCase() + temp.slice(1)} · ${score}`
}

export function AgentAssignedLeads() {
  const [params, setParams] = useSearchParams()
  const drawerLeadId = params.get('lead') || ''
  const [filter, setFilter] = useState<FilterTab>('all')
  const [items, setItems] = useState<CrmLead[]>([])
  const [total, setTotal] = useState(0)
  const [hotCount, setHotCount] = useState(0)
  const [followUpCount, setFollowUpCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [callLead, setCallLead] = useState<CrmLead | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, hotRes, fuRes] = await Promise.all([
        crmService.listLeads({
          q: search || undefined,
          temperature: filter === 'hot' ? 'hot' : undefined,
          followUpDue: filter === 'follow-up' ? true : undefined,
          limit: 50,
        }),
        crmService.listLeads({ temperature: 'hot', limit: 1 }),
        crmService.listLeads({ followUpDue: true, limit: 1 }),
      ])
      setItems(listRes.items)
      setTotal(listRes.total)
      setHotCount(hotRes.total)
      setFollowUpCount(fuRes.total)
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    void load()
  }, [load])

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

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All assigned', count: total },
    { id: 'hot', label: 'Hot priority', count: hotCount },
    { id: 'follow-up', label: 'Follow-up due', count: followUpCount },
  ]

  return (
    <div className="space-y-4">
      <div className="lc-agent-filter-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`lc-agent-filter-tab${filter === tab.id ? ' lc-agent-filter-tab--active' : ''}`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="lc-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search my assigned leads…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 ring-1 ring-sky-100">
            Showing only your assigned leads
          </p>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading your leads…</p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No assigned leads match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="lc-table min-w-full">
              <thead>
                <tr>
                  <th className="w-12 pl-4">#</th>
                  <th>Student</th>
                  <th>Training &amp; source</th>
                  <th>Intent</th>
                  <th>Status</th>
                  <th>Next action</th>
                  <th className="pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => {
                  const next = formatNextAction(row)
                  const stageKey = row.lifecycleStage || 'new'
                  const stageClass = STAGE_COLORS[stageKey] || STAGE_COLORS.new
                  return (
                    <tr key={row.id}>
                      <td className="pl-4 text-sm font-bold text-slate-400">{idx + 1}</td>
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
                      <td className={next.urgent ? 'text-sm font-semibold text-red-600' : 'text-sm text-slate-600'}>
                        {next.text}
                      </td>
                      <td className="pr-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDrawer(row.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-slate-600 hover:bg-slate-50"
                            aria-label="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCallLead(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#2563eb]/30 text-[#2563eb] hover:bg-[#2563eb]/5"
                            aria-label="Call lead"
                          >
                            <Phone className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && items.length > 0 && (
          <p className="border-t border-gray-100 px-4 py-2 text-xs text-slate-500">
            Showing {items.length} of {total} assigned leads
          </p>
        )}
      </div>

      {drawerLeadId && <LeadDetailDrawer leadId={drawerLeadId} onClose={closeDrawer} />}
      <CallLeadModal open={!!callLead} lead={callLead} onClose={() => setCallLead(null)} />
    </div>
  )
}
