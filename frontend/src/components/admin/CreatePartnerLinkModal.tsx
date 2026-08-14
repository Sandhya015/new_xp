import { useEffect, useState } from 'react'
import { CheckCircle2, Link2, QrCode, X } from 'lucide-react'
import { adminPartnerService } from '@/services/partnerService'
import { CopyField, qrUrl } from '@/components/partner/PartnerUI'

export type LinkFormState = {
  label: string
  linkType: 'site_wide' | 'training'
  trainingId: string
  commissionOverride: string
  validTill: string
  customSlug: string
}

const EMPTY: LinkFormState = {
  label: '',
  linkType: 'site_wide',
  trainingId: '',
  commissionOverride: '',
  validTill: '',
  customSlug: '',
}

type CreatedLink = {
  url: string
  slug: string
  label: string
}

export function CreatePartnerLinkModal({
  open,
  partnerId,
  partner,
  trainings,
  onClose,
  onCreated,
}: {
  open: boolean
  partnerId: string
  partner: Record<string, unknown>
  trainings: Array<{ id: string; title: string }>
  onClose: () => void
  onCreated: () => void
}) {
  const defaultCommission = Number(partner.commissionPercent || 10)
  const partnerCode = String(partner.partnerCode || '')
  const [form, setForm] = useState<LinkFormState>({ ...EMPTY })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<CreatedLink | null>(null)

  useEffect(() => {
    if (!open) return
    setForm({ ...EMPTY })
    setError('')
    setCreated(null)
  }, [open])

  const set = <K extends keyof LinkFormState>(key: K, value: LinkFormState[K]) => {
    setError('')
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleClose = () => {
    if (created) onCreated()
    onClose()
  }

  const submit = async () => {
    if (!form.label.trim()) {
      setError('Please enter a label for this link.')
      return
    }
    if (form.linkType === 'training' && !form.trainingId) {
      setError('Select a training for training-specific links.')
      return
    }
    const override = form.commissionOverride.trim()
    if (override !== '' && (Number(override) <= 0 || Number(override) > 100)) {
      setError('Commission override must be between 1 and 100%.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        label: form.label.trim(),
        linkType: form.linkType,
        trainingId: form.linkType === 'training' ? form.trainingId : '',
      }
      if (override !== '') body.commissionOverride = Number(override)
      if (form.validTill) body.validTill = form.validTill
      if (form.customSlug.trim()) body.customSlug = form.customSlug.trim().toUpperCase()

      const res = await adminPartnerService.createLink(partnerId, body)
      const link = (res as { link?: Record<string, unknown> }).link || {}
      setCreated({
        url: String(link.url || ''),
        slug: String(link.slug || ''),
        label: String(link.label || form.label),
      })
    } catch (err) {
      if (err && typeof err === 'object' && 'response' in err) {
        const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
        setError(msg ? String(msg) : 'Could not create referral link')
      } else {
        setError('Could not create referral link')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">{created ? 'Link created' : 'Create referral link'}</h2>
            <p className="text-sm text-slate-gray">
              {created ? 'Share this trackable URL with the partner.' : 'Generate a trackable link with optional commission override.'}
            </p>
          </div>
          <button type="button" onClick={handleClose} className="rounded-lg p-2 text-slate-gray hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {created ? (
          <div className="space-y-5 overflow-y-auto p-6">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>
                <strong>{created.label}</strong> is ready to share.
              </span>
            </div>
            <CopyField value={created.url} label="Referral URL" />
            <p className="text-xs text-slate-gray font-mono">Slug: {created.slug}</p>
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-gray-50 p-4">
              <img src={qrUrl(created.url, 160)} alt="QR code for referral link" className="rounded-lg border bg-white p-2" width={160} height={160} />
              <a
                href={qrUrl(created.url, 512)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-accent hover:underline"
              >
                <QrCode className="h-3.5 w-3.5" /> Download QR code
              </a>
            </div>
            <button type="button" onClick={handleClose} className="w-full rounded-xl bg-brand-accent py-2.5 text-sm font-semibold text-white">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4 overflow-y-auto p-6">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Link name / label</label>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="e.g. Instagram bio link"
                  value={form.label}
                  onChange={(e) => set('label', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Link type</label>
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.linkType}
                  onChange={(e) => set('linkType', e.target.value as LinkFormState['linkType'])}
                >
                  <option value="site_wide">Site-wide</option>
                  <option value="training">Training-specific</option>
                </select>
              </div>

              {form.linkType === 'training' ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Training</label>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={form.trainingId}
                    onChange={(e) => set('trainingId', e.target.value)}
                  >
                    <option value="">Select training</option>
                    {trainings.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Custom slug (optional)</label>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-lg bg-gray-100 px-2 py-2 font-mono text-xs text-slate-gray">{partnerCode}-</span>
                  <input
                    className="min-w-0 flex-1 rounded-xl border px-3 py-2 font-mono text-sm uppercase"
                    placeholder="INSTA"
                    value={form.customSlug}
                    onChange={(e) => set('customSlug', e.target.value.toUpperCase())}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-gray">Letters and numbers only. Leave blank for an auto-generated slug.</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Commission override %</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder={`Default ${defaultCommission}%`}
                  value={form.commissionOverride}
                  onChange={(e) => set('commissionOverride', e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-gray">Blank uses partner default ({defaultCommission}%).</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Valid until</label>
                <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm" value={form.validTill} onChange={(e) => set('validTill', e.target.value)} />
                <p className="mt-1 text-[11px] text-slate-gray">Optional. Link stops working after this date.</p>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-dashed bg-gray-50 p-3 text-xs text-slate-gray">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
                <span>
                  URL will look like{' '}
                  <span className="font-mono text-[#0f172a]">
                    xpertintern.com/?ref={partnerCode}-{form.customSlug.trim() || 'INSTA'}
                  </span>
                </span>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="rounded-xl bg-brand-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Creating…' : 'Create link'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
