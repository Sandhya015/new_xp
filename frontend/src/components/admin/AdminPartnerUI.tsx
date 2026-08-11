import type { ReactNode } from 'react'
import { IndianRupee, Users, UserCheck, Wallet, Mail, Zap, Shield } from 'lucide-react'

export function fmtInr(n: number, compact = false) {
  if (compact && n >= 100000) return `₹${(n / 100000).toFixed(2)}L`.replace('.00L', 'L')
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export function partnerInitials(name: string) {
  return (name || 'P')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function AdminPartnerPageHeader({
  eyebrow = 'Partner management',
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
        <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-accent">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold text-[#0f172a] sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-slate-gray">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div> : null}
    </div>
  )
}

export function AdminStatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof Users
  iconBg: string
  iconColor: string
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
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

export function AdminStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase().replace(/\s+/g, '_')
  let cls = 'bg-gray-100 text-gray-700'
  if (s === 'active' || s === 'approved' || s === 'eligible') cls = 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  else if (s === 'suspended' || s === 'rejected') cls = 'bg-red-50 text-red-700 ring-1 ring-red-200'
  else if (s === 'submitted') cls = 'bg-orange-50 text-orange-800 ring-1 ring-orange-200'
  else if (s === 'under_review') cls = 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
  else if (s === 'needs_more_info') cls = 'bg-violet-50 text-violet-700 ring-1 ring-violet-200'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function PartnerAvatar({ name }: { name: string }) {
  const ini = partnerInitials(name)
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-bold text-brand-accent">
      {ini}
    </div>
  )
}

export function AdminTableShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {children}
      {footer ? <div className="border-t border-gray-100 px-4 py-3 text-xs text-slate-gray">{footer}</div> : null}
    </div>
  )
}

export function AdminFilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">{children}</div>
}

export function AdminInfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
      <Shield className="h-5 w-5 shrink-0 text-brand-accent mt-0.5" />
      <div>{children}</div>
    </div>
  )
}

export const PARTNER_STAT_ICONS = {
  total: { icon: Users, bg: 'bg-blue-50', color: 'text-blue-600' },
  active: { icon: UserCheck, bg: 'bg-emerald-50', color: 'text-emerald-600' },
  earnings: { icon: IndianRupee, bg: 'bg-orange-50', color: 'text-orange-600' },
  pending: { icon: Mail, bg: 'bg-violet-50', color: 'text-violet-600' },
  hold: { icon: Zap, bg: 'bg-violet-50', color: 'text-violet-600' },
  paid: { icon: Wallet, bg: 'bg-emerald-50', color: 'text-emerald-600' },
}

export function payoutMethodLabel(p: Record<string, unknown>) {
  const bank = (p.bank || {}) as Record<string, string>
  if (p.upiId) return `UPI · ${String(p.upiId)}`
  if (bank.accountNumber) {
    const last = bank.accountNumber.slice(-4)
    return `Bank account · ****${last}`
  }
  return '—'
}
