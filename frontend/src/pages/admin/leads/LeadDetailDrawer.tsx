import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Phone, Shuffle, X } from 'lucide-react'
import { crmService, type CrmAgent, type CrmLeadDetail } from '@/services/crmService'
import { LIFECYCLE_LABEL, TEMP_COLORS, leadInitials } from './shared'

type Props = {
  leadId: string
  onClose: () => void
  onUpdated?: () => void
}

function fmtDisposition(d: string) {
  return d.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function LeadDetailDrawer({ leadId, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<CrmLeadDetail | null>(null)
  const [agents, setAgents] = useState<CrmAgent[]>([])
  const [dispositions, setDispositions] = useState<string[]>([])
  const [tab, setTab] = useState<'overview' | 'activity' | 'calls' | 'notes'>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [disposition, setDisposition] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [assignAgentId, setAssignAgentId] = useState('')
  const [callMsg, setCallMsg] = useState('')

  const reload = () => {
    if (!leadId) return
    crmService.getLead(leadId).then(setDetail).catch(() => setDetail(null))
    onUpdated?.()
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      crmService.getLead(leadId),
      crmService.listAgents().catch(() => []),
      crmService.listDispositions().catch(() => []),
    ])
      .then(([d, a, disp]) => {
        setDetail(d)
        setAgents(a)
        setDispositions(disp)
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [leadId])

  const lead = detail?.lead

  const handleAssign = async () => {
    if (!assignAgentId || saving) return
    setSaving(true)
    try {
      await crmService.assignLead(leadId, assignAgentId)
      reload()
    } finally {
      setSaving(false)
    }
  }

  const handleCall = async () => {
    setSaving(true)
    setCallMsg('')
    try {
      const r = await crmService.initiateCall(leadId)
      setCallMsg(r.message || 'Call initiated')
      reload()
    } catch {
      setCallMsg('Call failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDisposition = async () => {
    if (!disposition || !note.trim()) return
    setSaving(true)
    try {
      await crmService.setDisposition(leadId, {
        disposition,
        followUpAt: followUpAt || undefined,
        note: note.trim(),
      })
      setNote('')
      reload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" className="lc-drawer-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="lc-drawer" role="dialog" aria-label="Lead profile">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {loading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : lead ? (
                <>
                  <p className="text-xs font-semibold text-slate-400">XI-{lead.id.slice(-4).toUpperCase()}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="lc-avatar">{leadInitials(lead.fullName)}</span>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-slate-900">{lead.fullName}</h2>
                      <p className="truncate text-sm text-slate-500">{lead.mobile || lead.email}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-red-600 text-sm">Lead not found</p>
              )}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          {lead && (
            <>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleCall}
                  disabled={saving}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white"
                >
                  <Phone className="h-4 w-4" /> Call via TeleCMI
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('drawer-assign')?.focus()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  <Shuffle className="h-4 w-4" /> Assign
                </button>
              </div>
              {callMsg && <p className="mt-2 text-xs text-slate-600">{callMsg}</p>}
              <div className="mt-4 rounded-xl border border-gray-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Intent score</p>
                    <p className="text-2xl font-bold text-slate-900">{lead.score}</p>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${TEMP_COLORS[lead.temperature]}`}>
                      {lead.temperature} intent
                    </span>
                  </div>
                  <span className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-gray-200 capitalize">
                    {LIFECYCLE_LABEL[lead.lifecycleStage] || lead.lifecycleStage}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex gap-1 border-b border-gray-100">
                {(['overview', 'activity', 'calls', 'notes'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`px-3 py-2 text-xs font-semibold capitalize border-b-2 -mb-px ${
                      tab === t ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-slate-500'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 p-5 space-y-4">
          {!lead ? null : tab === 'overview' ? (
            <>
              <h3 className="text-sm font-semibold text-slate-900">Lead details</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">Course</dt><dd className="font-medium">{lead.lastCourseTitle || '—'}</dd></div>
                <div><dt className="text-slate-500">Source</dt><dd className="font-medium capitalize">{lead.lastSource || '—'}</dd></div>
                <div><dt className="text-slate-500">Assigned</dt><dd className="font-medium">{lead.assignedToName || 'Unassigned'}</dd></div>
                <div><dt className="text-slate-500">Follow-up</dt><dd className="font-medium">{lead.followUpAt ? new Date(lead.followUpAt).toLocaleString() : '—'}</dd></div>
              </dl>
              <div id="drawer-assign" className="rounded-xl border border-gray-200 p-3">
                <label className="text-xs font-semibold text-slate-600">Assign to agent</label>
                <select value={assignAgentId} onChange={(e) => setAssignAgentId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Select agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.fullName}</option>
                  ))}
                </select>
                <button type="button" onClick={handleAssign} disabled={!assignAgentId || saving} className="mt-2 w-full rounded-lg bg-[#1e3a5f] py-2 text-sm font-semibold text-white disabled:opacity-50">
                  Assign lead
                </button>
              </div>
              <Link to={`/admin/leads/profile/${leadId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563eb] hover:underline">
                Open full profile <ExternalLink className="h-3 w-3" />
              </Link>
            </>
          ) : tab === 'activity' ? (
            <ul className="space-y-2">
              {(detail?.events || []).map((ev) => (
                <li key={ev.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                  <p className="font-medium">{ev.eventType.replace(/\./g, ' ')}</p>
                  <p className="text-xs text-slate-500">{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}</p>
                </li>
              ))}
            </ul>
          ) : tab === 'calls' ? (
            <ul className="space-y-2 text-sm">
              {(detail?.calls || []).length === 0 ? (
                <p className="text-slate-500">No calls logged yet</p>
              ) : (
                detail!.calls.map((c) => (
                  <li key={c.id} className="rounded-lg border border-gray-100 p-3">
                    {c.status} · {c.durationSec ?? 0}s
                  </li>
                ))
              )}
            </ul>
          ) : (
            <>
              <select value={disposition} onChange={(e) => setDisposition(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">Disposition</option>
                {dispositions.map((d) => (
                  <option key={d} value={d}>{fmtDisposition(d)}</option>
                ))}
              </select>
              <input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required for disposition)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              <button type="button" onClick={handleDisposition} disabled={!disposition || !note.trim() || saving} className="w-full rounded-lg bg-[#2563eb] py-2 text-sm font-semibold text-white disabled:opacity-50">
                Save disposition
              </button>
              <ul className="space-y-2 pt-2">
                {(detail?.notes || []).map((n) => (
                  <li key={n.id} className="rounded bg-slate-50 px-2 py-1 text-sm">{n.body}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
