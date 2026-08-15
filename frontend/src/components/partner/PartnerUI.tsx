import { useState, type ReactNode } from 'react'
import { Check, Copy, TrendingUp } from 'lucide-react'

export function fmtInr(n: number) {
  const val = Number(n) || 0
  // Show paise for fractional amounts and sub-₹1000 values so small commissions display correctly.
  if (Math.abs(val) < 1000 || Math.abs(val - Math.round(val)) > 0.001) {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `₹${Math.round(val).toLocaleString('en-IN')}`
}

export function partnerInitials(name: string) {
  return (name || 'P')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-accent">{eyebrow}</p>
        ) : (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-gray">Partner Dashboard</p>
        )}
        <h1 className="mt-1 text-2xl font-bold text-[#0f172a] sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-slate-gray">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg = 'bg-blue-50',
  iconColor = 'text-brand-accent',
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof TrendingUp
  iconBg?: string
  iconColor?: string
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-gray">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#0f172a]">{value}</p>
          {sub ? <p className="mt-1 text-xs text-slate-gray">{sub}</p> : null}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  let cls = 'bg-gray-100 text-gray-700'
  if (s.includes('active') || s.includes('success') || s.includes('paid') || s.includes('resolved')) {
    cls = 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  } else if (s.includes('pending') || s.includes('hold') || s.includes('earned') || s.includes('waiting') || s.includes('progress')) {
    cls = 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
  } else if (s.includes('created') || s.includes('processing')) {
    cls = 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
  } else if (s.includes('cancel') || s.includes('refund')) {
    cls = 'bg-orange-50 text-orange-800 ring-1 ring-orange-200'
  }
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>{status}</span>
}

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div>
      {label ? <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-gray">{label}</p> : null}
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-800">{value}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export function BarChart({ points, height = 160 }: { points: Array<{ date: string; value: number }>; height?: number }) {
  if (!points.length) {
    return <p className="py-8 text-center text-sm text-slate-gray">No data for this period yet.</p>
  }
  const max = Math.max(...points.map((p) => p.value), 1)
  const w = Math.max(points.length * 28, 280)
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full min-w-[280px]" style={{ height }}>
        {points.map((p, i) => {
          const barH = (p.value / max) * (height - 40)
          const x = i * 28 + 8
          const y = height - 24 - barH
          return (
            <g key={p.date}>
              <rect x={x} y={y} width={18} height={Math.max(barH, 2)} rx={4} fill="#2563eb" opacity={0.85} />
              {i % Math.ceil(points.length / 6) === 0 ? (
                <text x={x + 9} y={height - 6} textAnchor="middle" fontSize="8" fill="#94a3b8">
                  {p.date.slice(5)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function SplitBarChart({
  referral,
  coupon,
  height = 160,
}: {
  referral: Array<{ date: string; value: number }>
  coupon: Array<{ date: string; value: number }>
  height?: number
}) {
  const dates = [...new Set([...referral.map((p) => p.date), ...coupon.map((p) => p.date)])].sort()
  if (!dates.length) {
    return <p className="py-8 text-center text-sm text-slate-gray">No earnings data for this period yet.</p>
  }
  const refMap = Object.fromEntries(referral.map((p) => [p.date, p.value]))
  const cpMap = Object.fromEntries(coupon.map((p) => [p.date, p.value]))
  const max = Math.max(...dates.map((d) => (refMap[d] || 0) + (cpMap[d] || 0)), 1)
  const w = Math.max(dates.length * 32, 280)
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-gray">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#2563eb]" /> Referral links</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#ea580c]" /> Coupons</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${height}`} className="w-full min-w-[280px]" style={{ height }}>
          {dates.map((date, i) => {
            const refVal = refMap[date] || 0
            const cpVal = cpMap[date] || 0
            const total = refVal + cpVal
            const barH = (total / max) * (height - 40)
            const refH = total ? (refVal / total) * barH : 0
            const cpH = barH - refH
            const x = i * 32 + 8
            const yRef = height - 24 - barH
            return (
              <g key={date}>
                {refH > 0 ? <rect x={x} y={yRef} width={18} height={refH} rx={4} fill="#2563eb" /> : null}
                {cpH > 0 ? <rect x={x} y={yRef + refH} width={18} height={cpH} rx={4} fill="#ea580c" /> : null}
                {i % Math.ceil(dates.length / 6) === 0 ? (
                  <text x={x + 9} y={height - 6} textAnchor="middle" fontSize="8" fill="#94a3b8">
                    {date.slice(5)}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export function FunnelRow({ label, value, pct, color }: { label: string; value: string | number; pct: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold text-[#0f172a]">{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(pct, 4))}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
      <p className="font-semibold text-brand-navy">{title}</p>
      <p className="mt-2 text-sm text-slate-gray">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>{children}</div>
}

export function shareWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
}

export function qrUrl(data: string, size = 120) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
}
