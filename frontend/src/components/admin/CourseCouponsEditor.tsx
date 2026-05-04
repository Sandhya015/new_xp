/**
 * Per-course enrollment coupons for Manage Training (replaces raw JSON editing).
 */
import { Plus, Trash2 } from 'lucide-react'

export type EnrollmentCouponFormRow = {
  code: string
  label: string
  discountType: 'percent' | 'rupees'
  discountValue: string
  maxDiscountInr: string
  maxUses: string
  perUserLimit: string
  validFrom: string
  validUntil: string
  active: boolean
}

export function defaultCouponRow(): EnrollmentCouponFormRow {
  return {
    code: '',
    label: '',
    discountType: 'rupees',
    discountValue: '',
    maxDiscountInr: '',
    maxUses: '',
    perUserLimit: '1',
    validFrom: '',
    validUntil: '',
    active: true,
  }
}

function rowFromApi(raw: Record<string, unknown>): EnrollmentCouponFormRow {
  const pct = raw.percentOff != null
  const rupees = raw.rupeesOff != null
  const discType: 'percent' | 'rupees' = pct && !rupees ? 'percent' : 'rupees'
  let discountValue = ''
  if (discType === 'percent') {
    try {
      discountValue = String(raw.percentOff != null ? Number(raw.percentOff) : '')
    } catch {
      discountValue = ''
    }
  } else {
    try {
      discountValue = String(raw.rupeesOff != null ? Number(raw.rupeesOff) : '')
    } catch {
      discountValue = ''
    }
  }
  return {
    code: String(raw.code || '').trim().toUpperCase(),
    label: String(raw.label || ''),
    discountType: discType,
    discountValue,
    maxDiscountInr:
      raw.maxDiscountInr != null && String(raw.maxDiscountInr).trim() ? String(raw.maxDiscountInr) : '',
    maxUses: raw.maxUses != null && String(raw.maxUses).trim() ? String(raw.maxUses) : '',
    perUserLimit:
      raw.perUserLimit != null && String(raw.perUserLimit).trim() ? String(raw.perUserLimit) : '1',
    validFrom: typeof raw.validFrom === 'string' ? raw.validFrom.slice(0, 10) : '',
    validUntil: typeof raw.validUntil === 'string' ? raw.validUntil.slice(0, 10) : '',
    active: raw.active !== false,
  }
}

export function couponsFromApiList(rows: unknown[] | undefined): EnrollmentCouponFormRow[] {
  if (!Array.isArray(rows)) return []
  const out: EnrollmentCouponFormRow[] = []
  for (const r of rows) {
    if (r && typeof r === 'object') out.push(rowFromApi(r as Record<string, unknown>))
  }
  return out
}

export function couponsToApiList(rows: EnrollmentCouponFormRow[]): Record<string, unknown>[] {
  return rows
    .map((r) => {
      const code = (r.code || '').trim().toUpperCase()
      if (!code) return null
      const o: Record<string, unknown> = {
        code,
        label: (r.label || '').trim(),
        active: r.active,
        perUserLimit: parseInt(r.perUserLimit, 10) || 1,
      }
      if (r.discountType === 'percent') {
        const p = parseFloat(r.discountValue)
        if (!Number.isFinite(p) || p <= 0) return null
        o.percentOff = p
        const cap = parseFloat(r.maxDiscountInr)
        if (Number.isFinite(cap) && cap > 0) o.maxDiscountInr = cap
      } else {
        const x = parseFloat(r.discountValue)
        if (!Number.isFinite(x) || x <= 0) return null
        o.rupeesOff = x
      }
      const mu = parseInt(r.maxUses, 10)
      if (Number.isFinite(mu) && mu >= 0) o.maxUses = mu
      if (r.validFrom.trim()) o.validFrom = r.validFrom.trim()
      if (r.validUntil.trim()) o.validUntil = r.validUntil.trim()
      return o
    })
    .filter(Boolean) as Record<string, unknown>[]
}

type Props = {
  rows: EnrollmentCouponFormRow[]
  onChange: (rows: EnrollmentCouponFormRow[]) => void
  usedByCode: Record<string, { used: number; maxUses: number | null }>
}

export function CourseCouponsEditor({ rows, onChange, usedByCode }: Props) {
  const patch = (i: number, part: Partial<EnrollmentCouponFormRow>) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...part } : r)))
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-gray">Codes are case-insensitive. Empty rows are omitted on save.</p>
        <button
          type="button"
          onClick={() => onChange([...rows, defaultCouponRow()])}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add coupon
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Code</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Type</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Value</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">₹ cap (%)</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Max uses</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Used</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">/ user</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Valid</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">On</th>
              <th className="px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-xs text-slate-gray">
                  No coupons yet. Add one for this course.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const stat = usedByCode[(r.code || '').trim().toUpperCase()]
                const usedLabel =
                  stat != null
                    ? stat.maxUses != null
                      ? `${stat.used} / ${stat.maxUses}`
                      : `${stat.used}`
                    : '—'
                return (
                  <tr key={i} className="align-top">
                    <td className="px-2 py-2">
                      <input
                        value={r.code}
                        onChange={(e) => patch(i, { code: e.target.value.toUpperCase() })}
                        className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs font-mono uppercase"
                        placeholder="CODE"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={r.discountType}
                        onChange={(e) => patch(i, { discountType: e.target.value as 'percent' | 'rupees' })}
                        className="rounded border border-gray-300 px-1 py-1 text-xs"
                      >
                        <option value="rupees">Flat ₹</option>
                        <option value="percent">% off</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={r.discountValue}
                        onChange={(e) => patch(i, { discountValue: e.target.value })}
                        className="w-20 rounded border border-gray-300 px-1.5 py-1 text-xs"
                        inputMode="decimal"
                        placeholder={r.discountType === 'percent' ? '%' : '₹'}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={r.maxDiscountInr}
                        onChange={(e) => patch(i, { maxDiscountInr: e.target.value })}
                        disabled={r.discountType !== 'percent'}
                        className="w-20 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-100"
                        inputMode="decimal"
                        title="Max discount in ₹ when using %"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={r.maxUses}
                        onChange={(e) => patch(i, { maxUses: e.target.value })}
                        className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs"
                        inputMode="numeric"
                        placeholder="∞"
                      />
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-600">{usedLabel}</td>
                    <td className="px-2 py-2">
                      <input
                        value={r.perUserLimit}
                        onChange={(e) => patch(i, { perUserLimit: e.target.value })}
                        className="w-12 rounded border border-gray-300 px-1.5 py-1 text-xs"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <input
                          type="date"
                          value={r.validFrom}
                          onChange={(e) => patch(i, { validFrom: e.target.value })}
                          className="rounded border border-gray-300 px-1 py-0.5 text-[10px]"
                        />
                        <input
                          type="date"
                          value={r.validUntil}
                          onChange={(e) => patch(i, { validUntil: e.target.value })}
                          className="rounded border border-gray-300 px-1 py-0.5 text-[10px]"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={(e) => patch(i, { active: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => onChange(rows.filter((_, j) => j !== i))}
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                        aria-label="Remove coupon"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
