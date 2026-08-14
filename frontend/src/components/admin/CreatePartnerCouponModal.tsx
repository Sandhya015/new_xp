import { useEffect, useMemo, useState } from 'react'
import { Calculator, X } from 'lucide-react'
import { adminPartnerService } from '@/services/partnerService'
import { fmtInr, partnerInitials } from '@/components/admin/AdminPartnerUI'

export type CouponFormState = {
  code: string
  discountType: 'percent' | 'flat'
  discountValue: string
  minOrderValue: string
  maxDiscountCap: string
  commissionOverride: string
  trainingScope: 'all' | 'selected' | 'one'
  trainingIds: string[]
  validFrom: string
  validTill: string
  usageLimitTotal: string
  usageLimitPerStudent: string
}

const EMPTY: CouponFormState = {
  code: '',
  discountType: 'percent',
  discountValue: '10',
  minOrderValue: '',
  maxDiscountCap: '',
  commissionOverride: '',
  trainingScope: 'all',
  trainingIds: [],
  validFrom: '',
  validTill: '',
  usageLimitTotal: '500',
  usageLimitPerStudent: '1',
}

function normalizeCouponCode(raw: string) {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

function suggestCouponCode(partner: Record<string, unknown>, discountValue: string) {
  const fromName = partnerInitials(String(partner.fullName || 'XP')).replace(/[^A-Z]/g, '')
  const fromCode = String(partner.partnerCode || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase()
  const base = (fromName.length >= 2 ? fromName : fromCode || 'XP').slice(0, 8)
  const suffix = String(discountValue || '10').replace(/\D/g, '').slice(0, 3) || '10'
  return `${base}${suffix}`.slice(0, 16)
}

function num(raw: string) {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function calcPreview(
  form: CouponFormState,
  exampleFee: number,
  defaultCommissionPct: number,
) {
  const fee = Math.max(0, exampleFee)
  const minOrder = num(form.minOrderValue)
  const eligible = !minOrder || fee >= minOrder

  let discount = 0
  const dv = num(form.discountValue)
  if (form.discountType === 'percent') {
    discount = fee * (dv / 100)
    const cap = num(form.maxDiscountCap)
    if (cap > 0) discount = Math.min(discount, cap)
  } else {
    discount = dv
  }
  discount = Math.min(discount, fee)

  const studentPays = eligible ? Math.max(0, fee - discount) : 0
  const override = form.commissionOverride.trim()
  const commissionPct = override !== '' ? num(override) : defaultCommissionPct
  const partnerCommission = eligible ? Math.round(studentPays * (commissionPct / 100) * 100) / 100 : 0
  const platformRevenue = eligible ? Math.round((studentPays - partnerCommission) * 100) / 100 : 0

  return {
    eligible,
    fee,
    discount: Math.round(discount * 100) / 100,
    studentPays,
    commissionPct,
    partnerCommission,
    platformRevenue,
    usesDefaultCommission: override === '',
  }
}

export function CreatePartnerCouponModal({
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
  const [form, setForm] = useState<CouponFormState>({ ...EMPTY })
  const [exampleFee, setExampleFee] = useState('1000')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setExampleFee('1000')
    setForm({
      ...EMPTY,
      code: suggestCouponCode(partner, EMPTY.discountValue),
      commissionOverride: '',
    })
  }, [open, partner])

  const preview = useMemo(
    () => calcPreview(form, num(exampleFee), defaultCommission),
    [form, exampleFee, defaultCommission],
  )

  const set = <K extends keyof CouponFormState>(key: K, value: CouponFormState[K]) => {
    setError('')
    setForm((f) => ({ ...f, [key]: value }))
  }

  const toggleTraining = (id: string) => {
    setForm((f) => {
      const ids = f.trainingIds.includes(id) ? f.trainingIds.filter((x) => x !== id) : [...f.trainingIds, id]
      return { ...f, trainingIds: ids }
    })
  }

  const submit = async () => {
    const code = normalizeCouponCode(form.code)
    const discountValue = num(form.discountValue)
    if (code.length < 3) {
      setError('Coupon code must be at least 3 letters or numbers.')
      return
    }
    if (discountValue <= 0) {
      setError('Enter a student discount value greater than 0.')
      return
    }
    if (form.trainingScope === 'selected' && !form.trainingIds.length) {
      setError('Select at least one training for this coupon.')
      return
    }
    if (form.trainingScope === 'one' && form.trainingIds.length !== 1) {
      setError('Pick exactly one training for a single-training coupon.')
      return
    }
    const commissionOverride = form.commissionOverride.trim()
    if (commissionOverride !== '' && (num(commissionOverride) <= 0 || num(commissionOverride) > 100)) {
      setError('Partner commission must be between 1 and 100%.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        code,
        discountType: form.discountType,
        discountValue,
        trainingScope: form.trainingScope,
        usageLimitPerStudent: Math.max(1, parseInt(form.usageLimitPerStudent || '1', 10) || 1),
      }
      if (form.minOrderValue.trim()) body.minOrderValue = num(form.minOrderValue)
      if (form.maxDiscountCap.trim()) body.maxDiscountCap = num(form.maxDiscountCap)
      if (commissionOverride !== '') body.commissionOverride = num(commissionOverride)
      if (form.validFrom) body.validFrom = form.validFrom
      if (form.validTill) body.validTill = form.validTill
      if (form.usageLimitTotal.trim()) body.usageLimitTotal = parseInt(form.usageLimitTotal, 10)
      if (form.trainingScope !== 'all') body.trainingIds = form.trainingScope === 'one' ? form.trainingIds.slice(0, 1) : form.trainingIds

      await adminPartnerService.createCoupon(partnerId, body)
      onCreated()
      onClose()
    } catch (err) {
      if (err && typeof err === 'object' && 'response' in err) {
        const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
        setError(msg ? String(msg) : 'Could not create coupon')
      } else {
        setError('Could not create coupon')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Create coupon</h2>
            <p className="text-sm text-slate-gray">Set student discount and partner commission separately.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-gray hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-y-auto lg:grid-cols-2">
          <div className="space-y-4 border-b p-6 lg:border-b-0 lg:border-r">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Coupon code</label>
              <input
                className="w-full rounded-xl border px-3 py-2 font-mono text-sm uppercase"
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. RISHU10"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Discount type</label>
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.discountType}
                  onChange={(e) => set('discountType', e.target.value as CouponFormState['discountType'])}
                >
                  <option value="percent">Percentage off</option>
                  <option value="flat">Flat ₹ off</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Discount value</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.discountValue}
                  onChange={(e) => set('discountValue', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Minimum order value</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Optional"
                  value={form.minOrderValue}
                  onChange={(e) => set('minOrderValue', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Maximum discount cap</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Optional (for % discounts)"
                  value={form.maxDiscountCap}
                  onChange={(e) => set('maxDiscountCap', e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-accent">Partner commission</p>
              <p className="mt-1 text-xs text-slate-gray">Percentage of net paid amount (after student discount).</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-gray">Commission %</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    placeholder={`Default ${defaultCommission}%`}
                    value={form.commissionOverride}
                    onChange={(e) => set('commissionOverride', e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-slate-gray pb-2">
                    Leave blank to use partner default ({defaultCommission}%).
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Applicable trainings</label>
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.trainingScope}
                onChange={(e) => set('trainingScope', e.target.value as CouponFormState['trainingScope'])}
              >
                <option value="all">All trainings</option>
                <option value="selected">Selected trainings</option>
                <option value="one">One training only</option>
              </select>
              {form.trainingScope !== 'all' ? (
                <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border p-2">
                  {trainings.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
                      <input
                        type={form.trainingScope === 'one' ? 'radio' : 'checkbox'}
                        name="coupon-training"
                        checked={form.trainingIds.includes(t.id)}
                        onChange={() => {
                          if (form.trainingScope === 'one') set('trainingIds', [t.id])
                          else toggleTraining(t.id)
                        }}
                      />
                      <span className="truncate">{t.title}</span>
                    </label>
                  ))}
                  {!trainings.length ? <p className="px-2 py-1 text-xs text-slate-gray">No trainings loaded.</p> : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Valid from</label>
                <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Valid until</label>
                <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm" value={form.validTill} onChange={(e) => set('validTill', e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Total usage limit</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.usageLimitTotal}
                  onChange={(e) => set('usageLimitTotal', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-gray">Limit per student</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.usageLimitPerStudent}
                  onChange={(e) => set('usageLimitPerStudent', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-[#f8fafc] p-6">
            <div className="flex items-center gap-2 text-brand-accent">
              <Calculator className="h-5 w-5" />
              <h3 className="font-bold text-[#0f172a]">Live calculation</h3>
            </div>
            <p className="mt-1 text-xs text-slate-gray">Updates as you type. Commission is on amount actually paid after discount.</p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-gray">Example training fee</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                value={exampleFee}
                onChange={(e) => setExampleFee(e.target.value)}
              />
            </div>

            <div className="mt-4 space-y-2 rounded-xl border bg-white p-4 text-sm">
              <Row label="Training fee" value={fmtInr(preview.fee)} />
              <Row label="Student discount" value={`−${fmtInr(preview.discount)}`} accent="text-orange-600" />
              <Row label="Student pays" value={fmtInr(preview.studentPays)} bold />
              <div className="my-2 border-t border-dashed" />
              <Row
                label={`Partner commission (${preview.commissionPct}%${preview.usesDefaultCommission ? ', default' : ''})`}
                value={fmtInr(preview.partnerCommission)}
                accent="text-brand-accent"
                bold
              />
              <Row label="Platform revenue" value={fmtInr(preview.platformRevenue)} />
            </div>

            {!preview.eligible && form.minOrderValue ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Example fee is below minimum order value ({fmtInr(num(form.minOrderValue))}). Coupon would not apply.
              </p>
            ) : null}

            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
              Commission is calculated on the net amount the student pays after the discount — never on the original training price.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="rounded-xl bg-brand-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create coupon'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string
  value: string
  bold?: boolean
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-gray">{label}</span>
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${accent || 'text-[#0f172a]'}`}>{value}</span>
    </div>
  )
}
