import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Globe,
  Instagram,
  Youtube,
  Linkedin,
  FileText,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ExternalLink,
  Clock,
} from 'lucide-react'
import { adminPartnerService } from '@/services/partnerService'
import { AdminStatusBadge, PartnerAvatar } from '@/components/admin/AdminPartnerUI'
import { SectionCard } from '@/components/partner/PartnerUI'
import { showAppToast } from '@/components/AppToastHost'

function fmtDate(raw: string) {
  if (!raw) return '—'
  const d = new Date(raw.replace(' UTC', ''))
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DetailField({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-gray">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#0f172a] break-words whitespace-pre-wrap">{value || '—'}</p>
    </div>
  )
}

function SocialLink({ icon: Icon, label, href }: { icon: typeof Globe; label: string; href: string }) {
  const url = href.startsWith('http') ? href : href ? `https://${href}` : ''
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-brand-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-gray">{label}</p>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-brand-accent hover:underline truncate max-w-full">
            {href} <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <p className="mt-0.5 text-sm text-slate-gray">—</p>
        )}
      </div>
    </div>
  )
}

function historyLabel(action: string, note: string) {
  const a = action.toLowerCase()
  if (a === 'submitted') return 'Application submitted'
  if (a === 'under_review') return 'Opened for review'
  if (a === 'needs_more_info') return note || 'More information requested'
  if (a === 'approved') return note || 'Application approved'
  if (a === 'rejected') return note || 'Application rejected'
  return note || action.replace(/_/g, ' ')
}

function historyIcon(action: string) {
  const a = action.toLowerCase()
  if (a === 'approved') return CheckCircle2
  if (a === 'rejected') return XCircle
  if (a === 'needs_more_info') return MessageSquare
  if (a === 'submitted') return FileText
  return Clock
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SectionCard>
      <h3 className="mb-4 text-base font-bold text-[#0f172a]">{title}</h3>
      {children}
    </SectionCard>
  )
}

export function AdminPartnerApplicationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [app, setApp] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [commission, setCommission] = useState('10')
  const [question, setQuestion] = useState('')
  const [rejectReason, setRejectReason] = useState('Other')
  const [rejectMessage, setRejectMessage] = useState('')
  const [shareReason, setShareReason] = useState(true)
  const [rejectReasons, setRejectReasons] = useState<string[]>([
    'Incomplete information',
    'Not aligned with our audience',
    'Duplicate',
    'Suspicious',
    'Other',
  ])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')

  const reload = useCallback(() => {
    if (!id) return
    setLoading(true)
    adminPartnerService
      .getApplication(id)
      .then((r) => setApp(r.application))
      .catch(() => setApp(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    reload()
    adminPartnerService
      .pendingMeta()
      .then((m) => {
        if (m.rejectReasons?.length) setRejectReasons(m.rejectReasons)
      })
      .catch(() => undefined)
  }, [reload])

  if (loading && !app) {
    return <p className="text-sm text-slate-gray">Loading application…</p>
  }

  if (!app) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-gray">Application not found.</p>
        <button type="button" onClick={() => navigate('/admin/partners/applications')} className="mt-4 text-sm font-semibold text-brand-accent hover:underline">
          Back to applications
        </button>
      </div>
    )
  }

  const status = String(app.status || '')
  const isApproved = status === 'approved'
  const isRejected = status === 'rejected'
  const isTerminal = isApproved || isRejected
  const partnerId = String(app.partnerId || '')
  const history = Array.isArray(app.history) ? (app.history as Array<Record<string, unknown>>) : []

  return (
    <div className="space-y-6 pb-10">
      <Link
        to="/admin/partners/applications"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to applications
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <PartnerAvatar name={String(app.fullName || 'Applicant')} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-accent">Application review</p>
            <h1 className="mt-1 text-2xl font-bold text-[#0f172a]">{String(app.applicationId)}</h1>
            <p className="mt-1 text-sm text-slate-gray">{String(app.fullName)} · Submitted {fmtDate(String(app.createdAt))}</p>
          </div>
        </div>
        <AdminStatusBadge status={status} />
      </div>

      {isApproved && partnerId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-emerald-900">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>
              This application was approved
              {app.partnerCode ? ` · Partner ${String(app.partnerCode)}` : ''}.
            </span>
          </div>
          <Link
            to={`/admin/partners/${partnerId}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            View partner profile <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}

      {isRejected ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900">
          <XCircle className="h-5 w-5 shrink-0 text-red-600" />
          This application was rejected. Review actions are read-only.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel title="Applicant details">
            <div className="grid gap-5 sm:grid-cols-2">
              <DetailField label="Full name" value={String(app.fullName)} />
              <DetailField label="Partner type" value={String(app.partnerType)} />
              <DetailField label="Email" value={String(app.email)} />
              <DetailField label="Phone" value={String(app.phone)} />
              <DetailField label="City" value={String(app.city)} />
              <DetailField label="State" value={String(app.state)} />
            </div>
          </Panel>

          <Panel title="Organisation & reach">
            <div className="grid gap-5 sm:grid-cols-2">
              <DetailField label="Organisation" value={String(app.organisationName)} />
              <DetailField label="Audience size" value={String(app.audienceSize)} />
              <DetailField
                label="Prior affiliate experience"
                value={app.priorAffiliateExperience ? 'Yes' : 'No'}
              />
              <DetailField label="Referred by" value={String(app.referredBy)} />
              <DetailField label="Heard about us" value={String(app.heardAbout)} className="sm:col-span-2" />
            </div>
          </Panel>

          <Panel title="Online presence">
            <div className="grid gap-3 sm:grid-cols-2">
              <SocialLink icon={Globe} label="Website" href={String(app.websiteUrl)} />
              <SocialLink icon={Instagram} label="Instagram" href={String(app.instagram)} />
              <SocialLink icon={Youtube} label="YouTube" href={String(app.youtube)} />
              <SocialLink icon={Linkedin} label="LinkedIn" href={String(app.linkedin)} />
            </div>
          </Panel>

          <Panel title="Promotion plan">
            <DetailField label="How they plan to promote" value={String(app.promotePlan)} />
            {app.whyPartner ? (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <DetailField label="Why partner with us" value={String(app.whyPartner)} />
              </div>
            ) : null}
          </Panel>

          <div>
            <h3 className="mb-3 text-base font-bold text-[#0f172a]">Activity</h3>
            <SectionCard className="divide-y divide-gray-50 p-0 overflow-hidden">
              {history.length ? (
                [...history].reverse().map((h, i) => {
                  const Icon = historyIcon(String(h.action))
                  return (
                    <div key={i} className="flex gap-4 px-5 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                        <Icon className="h-5 w-5 text-brand-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[#0f172a]">
                            {historyLabel(String(h.action), String(h.note || ''))}
                          </p>
                          {i === 0 ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-brand-accent">Latest</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-gray">
                          {String(h.by || 'system')}
                          {h.at ? ` · ${fmtDate(String(h.at))}` : ''}
                        </p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="p-8 text-center text-sm text-slate-gray">No activity recorded yet.</p>
              )}
            </SectionCard>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          {!isTerminal ? (
            <>
              <SectionCard>
                <h3 className="mb-4 text-base font-bold text-[#0f172a]">Approve application</h3>
                <p className="mb-4 text-sm text-slate-gray">Create a partner account with the chosen commission rate.</p>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-gray">Commission %</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  disabled={!!busy}
                />
                <button
                  type="button"
                  disabled={isApproved || !!busy}
                  className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={async () => {
                    setBusy('approve')
                    try {
                      const r = await adminPartnerService.approve(String(app.id), { commissionPercent: Number(commission) })
                      showAppToast('Application approved')
                      const pid = (r as { partner?: { id?: string } }).partner?.id
                      if (pid) navigate(`/admin/partners/${pid}`)
                      else reload()
                    } catch {
                      showAppToast('Could not approve application', 'error')
                    } finally {
                      setBusy('')
                    }
                  }}
                >
                  {isApproved ? 'Already approved' : busy === 'approve' ? 'Approving…' : 'Approve & create partner'}
                </button>
              </SectionCard>

              <SectionCard>
                <h3 className="mb-4 text-base font-bold text-[#0f172a]">Request more info</h3>
                <textarea
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Ask the applicant for additional details…"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={!!busy}
                />
                <button
                  type="button"
                  disabled={!question.trim() || !!busy}
                  className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={async () => {
                    setBusy('info')
                    try {
                      await adminPartnerService.requestInfo(String(app.id), question)
                      showAppToast('Information request sent')
                      setQuestion('')
                      reload()
                    } catch {
                      showAppToast('Could not send request', 'error')
                    } finally {
                      setBusy('')
                    }
                  }}
                >
                  {busy === 'info' ? 'Sending…' : 'Request more info'}
                </button>
              </SectionCard>

              <SectionCard>
                <h3 className="mb-4 text-base font-bold text-[#0f172a]">Reject application</h3>
                <select
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  disabled={!!busy}
                >
                  {rejectReasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <textarea
                  className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Optional message to the applicant…"
                  value={rejectMessage}
                  onChange={(e) => setRejectMessage(e.target.value)}
                  disabled={!!busy}
                />
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-gray">
                  <input type="checkbox" checked={shareReason} onChange={(e) => setShareReason(e.target.checked)} disabled={!!busy} />
                  Share reason with applicant
                </label>
                <button
                  type="button"
                  disabled={!!busy}
                  className="mt-4 w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={async () => {
                    setBusy('reject')
                    try {
                      await adminPartnerService.reject(String(app.id), {
                        reason: rejectReason,
                        shareReason,
                        message: rejectMessage.trim() || undefined,
                      })
                      showAppToast('Application rejected')
                      reload()
                    } catch {
                      showAppToast('Could not reject application', 'error')
                    } finally {
                      setBusy('')
                    }
                  }}
                >
                  {busy === 'reject' ? 'Rejecting…' : 'Reject application'}
                </button>
              </SectionCard>
            </>
          ) : null}

          <SectionCard>
            <h3 className="mb-4 text-base font-bold text-[#0f172a]">Internal note</h3>
            <textarea
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              rows={3}
              placeholder="Add a private note for other admins…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!!busy}
            />
            <button
              type="button"
              disabled={!note.trim() || !!busy}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={async () => {
                setBusy('note')
                try {
                  await adminPartnerService.addNote(String(app.id), note)
                  showAppToast('Note saved')
                  setNote('')
                  reload()
                } catch {
                  showAppToast('Could not save note', 'error')
                } finally {
                  setBusy('')
                }
              }}
            >
              {busy === 'note' ? 'Saving…' : 'Save note'}
            </button>
            {app.internalNotes ? (
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-gray">Existing notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#0f172a]">{String(app.internalNotes)}</p>
              </div>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
