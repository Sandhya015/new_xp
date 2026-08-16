/**
 * Admin — Lead CRM profile: timeline, disposition, assign, click-to-call, notes.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, MessageSquare, User } from 'lucide-react'
import { crmService, type CrmAgent, type CrmLeadDetail } from '@/services/crmService'

function fmtDisposition(d: string) {
  return d.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<CrmLeadDetail | null>(null)
  const [agents, setAgents] = useState<CrmAgent[]>([])
  const [dispositions, setDispositions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [disposition, setDisposition] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [assignAgentId, setAssignAgentId] = useState('')
  const [callMsg, setCallMsg] = useState('')

  const reload = () => {
    if (!id) return
    crmService.getLead(id).then(setDetail).catch(() => setDetail(null))
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      crmService.getLead(id),
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
  }, [id])

  const lead = detail?.lead

  const handleAssign = async () => {
    if (!id || !assignAgentId || saving) return
    setSaving(true)
    try {
      await crmService.assignLead(id, assignAgentId)
      reload()
    } finally {
      setSaving(false)
    }
  }

  const handleDisposition = async () => {
    if (!id || !disposition || saving) return
    if (!note.trim()) {
      alert('A note is required for every disposition (PRD after-call workflow)')
      return
    }
    const needsFollowUp = disposition.startsWith('followup_') || disposition.startsWith('interested_')
    if (needsFollowUp && !followUpAt) {
      alert('Follow-up date/time is required for this disposition')
      return
    }
    setSaving(true)
    try {
      await crmService.setDisposition(id, {
        disposition,
        followUpAt: followUpAt || undefined,
        note: note || undefined,
      })
      setNote('')
      setFollowUpAt('')
      reload()
    } finally {
      setSaving(false)
    }
  }

  const handleNote = async () => {
    if (!id || !note.trim() || saving) return
    setSaving(true)
    try {
      await crmService.addNote(id, note.trim())
      setNote('')
      reload()
    } finally {
      setSaving(false)
    }
  }

  const handleCall = async () => {
    if (!id || saving) return
    setSaving(true)
    setCallMsg('')
    try {
      const r = await crmService.initiateCall(id)
      setCallMsg(
        r.mode === 'mock'
          ? (r.message || 'Mock call — configure TeleCMI Agent ID in backend .env')
          : (r.message || 'Call initiated — answer your phone first, then the lead will be connected'),
      )
      reload()
    } catch {
      setCallMsg('Call failed — check TeleCMI credentials')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-gray">Loading lead…</div>
  if (!lead) return <div className="p-6 text-red-600">Lead not found.</div>

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div className="flex items-center gap-4">
        <Link to="/admin/leads" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">{lead.fullName}</h2>
          <p className="text-sm text-slate-gray capitalize">{lead.temperature} · score {lead.score} · {lead.lifecycleStage.replace(/_/g, ' ')}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-brand-navy flex items-center gap-2"><User className="h-4 w-4" /> Contact</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-400" /> {lead.mobile || '—'}</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" /> {lead.email || '—'}</li>
              {lead.lastCourseTitle && <li className="text-gray-600">Course interest: {lead.lastCourseTitle}</li>}
              <li className="text-gray-500">Assigned: {lead.assignedToName || 'Unassigned'}</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={handleCall} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Phone className="h-4 w-4" /> Click to call
              </button>
              {callMsg && <span className="text-sm text-gray-600 self-center">{callMsg}</span>}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-brand-navy flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Timeline</h3>
            <ul className="mt-4 space-y-3 max-h-96 overflow-y-auto">
              {(detail?.events || []).map((ev) => (
                <li key={ev.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-brand-navy">{ev.eventType.replace(/\./g, ' ')}</span>
                    <span className="text-xs text-gray-500">{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Source: {ev.source}{ev.scoreDelta ? ` · +${ev.scoreDelta} score` : ''}</p>
                </li>
              ))}
            </ul>
          </div>

          {(detail?.calls?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-brand-navy">Call history</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {detail!.calls.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 border-b border-gray-100 pb-2 text-sm">
                    <div className="flex justify-between">
                      <span>{c.direction} · {c.status}{c.durationSec != null ? ` · ${c.durationSec}s` : ''}</span>
                      <span className="text-gray-500">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</span>
                    </div>
                    {c.recordingUrl && (
                      <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-accent hover:underline">
                        Play recording
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-brand-navy">Assign</h3>
            <select value={assignAgentId} onChange={(e) => setAssignAgentId(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.fullName} ({a.email})</option>
              ))}
            </select>
            <button type="button" onClick={handleAssign} disabled={!assignAgentId || saving} className="mt-2 w-full rounded-lg bg-brand-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Assign
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-brand-navy">Disposition</h3>
            <select value={disposition} onChange={(e) => setDisposition(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select outcome</option>
              {dispositions.map((d) => (
                <option key={d} value={d}>{fmtDisposition(d)}</option>
              ))}
            </select>
            <input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button type="button" onClick={handleDisposition} disabled={!disposition || saving} className="mt-2 w-full rounded-lg bg-brand-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Save disposition
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-brand-navy">Notes</h3>
            <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto text-sm">
              {(detail?.notes || []).map((n) => (
                <li key={n.id} className="rounded bg-gray-50 px-2 py-1">
                  <p>{n.body}</p>
                  <p className="text-xs text-gray-500">{n.authorName} · {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
                </li>
              ))}
            </ul>
            <button type="button" onClick={handleNote} disabled={!note.trim() || saving} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">
              Add note only
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
