import { useState } from 'react'
import { Link } from 'react-router-dom'
import { partnerService } from '@/services/partnerService'

export function ApplyPartnerStatus() {
  const [applicationId, setApplicationId] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [app, setApp] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)

  const check = async () => {
    setBusy(true)
    setError(null)
    setApp(null)
    try {
      const r = await partnerService.status(applicationId.trim(), email.trim())
      setApp(r.application)
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Not found')
          : 'Not found'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const status = String(app?.status || '')
  const steps = ['submitted', 'under_review', 'decision', 'onboarded']
  const stepIndex =
    status === 'approved' ? 3 : status === 'rejected' ? 2 : status === 'needs_more_info' || status === 'under_review' ? 1 : 0

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold text-brand-navy">Application status</h1>
      <p className="mt-1 text-sm text-slate-gray">Enter your reference number and registered email.</p>
      <div className="mt-6 space-y-3 rounded-xl border bg-white p-6 shadow-sm">
        <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="APP-2026-00042" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} />
        <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="button" disabled={busy} onClick={() => void check()} className="w-full rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-white">
          {busy ? 'Checking…' : 'Check status'}
        </button>
      </div>
      {app ? (
        <div className="mt-8 space-y-4 rounded-xl border p-6">
          <p className="text-sm">
            Status: <strong className="capitalize">{status.replace(/_/g, ' ')}</strong>
          </p>
          <p className="text-xs text-slate-gray">Submitted: {String(app.createdAt || '')} · Expected review: ~{String(app.expectedTurnaroundDays || 3)} working days</p>
          <div className="flex gap-2">
            {steps.map((s, i) => (
              <div key={s} className={`flex-1 rounded py-2 text-center text-[10px] capitalize ${i <= stepIndex ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400'}`}>
                {s.replace('_', ' ')}
              </div>
            ))}
          </div>
          {status === 'needs_more_info' && app.adminQuestion ? (
            <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded">Admin question: {String(app.adminQuestion)}</p>
          ) : null}
          {status === 'rejected' ? (
            <p className="text-sm text-red-700">Rejected{app.rejectReasonShared ? `: ${String(app.rejectReasonShared)}` : '.'}</p>
          ) : null}
          {status === 'approved' ? (
            <Link to="/partner/login" className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
              Login to Partner Dashboard →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
