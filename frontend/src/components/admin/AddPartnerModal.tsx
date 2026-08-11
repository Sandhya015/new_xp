import { useState } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { adminPartnerService } from '@/services/partnerService'

const PARTNER_TYPES = [
  'Individual',
  'College',
  'Coaching Institute',
  'Influencer',
  'YouTuber',
  'Student Community',
  'Other',
]

const EMPTY = {
  fullName: '',
  partnerType: 'Individual',
  email: '',
  phone: '',
  organisationName: '',
  cityState: '',
  commissionPercent: '10',
  status: 'active',
  pan: '',
  upiId: '',
  notes: '',
}

export function AddPartnerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (partnerId?: string) => void
}) {
  const [form, setForm] = useState({ ...EMPTY })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const reset = () => {
    setForm({ ...EMPTY })
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const submit = async () => {
    setError(null)
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('Full name, email and phone are required.')
      return
    }
    const parts = form.cityState.split(',').map((s) => s.trim())
    const city = parts[0] || ''
    const state = parts.slice(1).join(', ') || ''

    setBusy(true)
    try {
      const r = await adminPartnerService.createPartner({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        partnerType: form.partnerType,
        organisationName: form.organisationName.trim(),
        city,
        state,
        commissionPercent: Number(form.commissionPercent || 10),
        status: form.status,
        pan: form.pan.trim(),
        upiId: form.upiId.trim(),
        notes: form.notes.trim(),
      })
      const pid = (r as { partner?: { id?: string } }).partner?.id
      reset()
      onCreated(pid)
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Could not create partner')
          : 'Could not create partner'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="add-partner-title">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="overflow-y-auto px-6 pb-6 pt-8 sm:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-accent">New partner</p>
          <h2 id="add-partner-title" className="mt-1 text-2xl font-bold text-[#0f172a]">
            Add a new partner
          </h2>
          <p className="mt-1 text-sm text-slate-gray">Create direct partner access and configure the commercial settings.</p>

          {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <div className="mt-8 space-y-8">
            <section>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent text-sm font-bold text-white">1</span>
                <h3 className="text-base font-bold text-[#0f172a]">Basic information</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name *" placeholder="Enter full name" value={form.fullName} onChange={(v) => set('fullName', v)} />
                <div>
                  <label className="block text-xs font-semibold text-[#334155]">Partner type *</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    value={form.partnerType}
                    onChange={(e) => set('partnerType', e.target.value)}
                  >
                    {PARTNER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <Field label="Email address *" placeholder="name@example.com" value={form.email} onChange={(v) => set('email', v)} type="email" />
                <Field label="Phone number *" placeholder="+91 98765 43210" value={form.phone} onChange={(v) => set('phone', v)} />
                <Field label="Organisation name" placeholder="Optional" value={form.organisationName} onChange={(v) => set('organisationName', v)} />
                <Field label="City and state" placeholder="Patna, Bihar" value={form.cityState} onChange={(v) => set('cityState', v)} />
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent text-sm font-bold text-white">2</span>
                <h3 className="text-base font-bold text-[#0f172a]">Commercial settings</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#334155]">Default commission % *</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="w-full rounded-xl border border-gray-200 py-2.5 pl-3 pr-10 text-sm"
                      value={form.commissionPercent}
                      onChange={(e) => set('commissionPercent', e.target.value)}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-gray">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#334155]">Account status</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    value={form.status}
                    onChange={(e) => set('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <Field label="PAN number" placeholder="Optional" value={form.pan} onChange={(v) => set('pan', v)} />
                <Field label="UPI ID" placeholder="Optional" value={form.upiId} onChange={(v) => set('upiId', v)} />
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#334155]">Internal notes</label>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-y min-h-[88px]"
                    placeholder="Only visible to administrators"
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/80 px-6 py-4 sm:px-8">
          <button type="button" onClick={handleClose} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create partner'}
            {!busy ? <ArrowUpRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#334155]">{label}</label>
      <input
        type={type}
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
