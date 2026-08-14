import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Pencil,
  MoreHorizontal,
  Link2,
  Gift,
  GraduationCap,
  CheckCircle2,
  Shield,
  Download,
  Plus,
  Eye,
  CreditCard,
  IndianRupee,
  Zap,
  Wallet,
  FileText,
  ChevronDown,
  User,
  Banknote,
  TrendingUp,
  PauseCircle,
  Trash2,
} from 'lucide-react'
import { adminPartnerService } from '@/services/partnerService'
import {
  AdminInfoBanner,
  AdminStatCard,
  AdminStatusBadge,
  fmtInr,
  partnerInitials,
  PARTNER_STAT_ICONS,
} from '@/components/admin/AdminPartnerUI'
import { BarChart, CopyField, FunnelRow, qrUrl, SectionCard } from '@/components/partner/PartnerUI'
import { showAppToast } from '@/components/AppToastHost'
import { CreatePartnerCouponModal } from '@/components/admin/CreatePartnerCouponModal'
import { CreatePartnerLinkModal } from '@/components/admin/CreatePartnerLinkModal'

type Tab = 'profile' | 'links' | 'coupons' | 'performance' | 'payouts' | 'activity'

type PartnerData = Awaited<ReturnType<typeof adminPartnerService.getPartner>>

const REF_PER_PAGE = 10

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'links', label: 'Referral links' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'performance', label: 'Performance' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'activity', label: 'Activity log' },
]

function fmtDate(raw: string) {
  if (!raw) return '—'
  const d = new Date(raw.replace(' UTC', ''))
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

function activityLabel(action: string, meta: Record<string, unknown>) {
  const a = action.toLowerCase()
  if (a.includes('approve') || a === 'partner_created') return 'Partner approved and account created'
  if (a.includes('link') || a.includes('referral_link')) return `Referral link '${String(meta.label || meta.slug || 'link')}' created`
  if (a.includes('coupon')) return `Coupon ${String(meta.code || meta.couponCode || '')} created`
  if (a.includes('bank') && a.includes('approv')) return 'Bank details approved'
  if (a.includes('bank') && a.includes('reject')) return 'Bank change rejected'
  if (a === 'commission_earned') return 'Successful student payment attributed'
  return action.replace(/_/g, ' ')
}

function activityIcon(action: string) {
  const a = action.toLowerCase()
  if (a.includes('approve') || a.includes('created')) return CheckCircle2
  if (a.includes('link')) return Link2
  if (a.includes('coupon')) return Gift
  if (a.includes('payout') || a.includes('bank')) return Pencil
  if (a.includes('shield') || a.includes('bank')) return Shield
  return FileText
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
      <Icon className="h-4 w-4 shrink-0 text-slate-gray mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-gray">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-[#0f172a] break-words">{value || '—'}</p>
      </div>
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SectionCard>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[#0f172a]">{title}</h3>
        {action}
      </div>
      {children}
    </SectionCard>
  )
}

export function AdminPartnerDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('profile')
  const [data, setData] = useState<PartnerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [trainings, setTrainings] = useState<Array<{ id: string; title: string }>>([])
  const [refPage, setRefPage] = useState(1)

  const reload = () => {
    if (!id) return
    setLoading(true)
    adminPartnerService
      .getPartner(id)
      .then((r) => {
        setData(r)
        setStatus(String(r.partner.status || ''))
        setNotes(String(r.partner.notes || ''))
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    adminPartnerService.pendingMeta().then((m) => setTrainings(m.trainings || [])).catch(() => undefined)
  }, [id])

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && TABS.some((x) => x.id === t)) setTab(t as Tab)
  }, [searchParams])

  const stats = (data?.stats || {}) as Record<string, number | Array<{ date: string; value: number }>>
  const p = data?.partner || {}
  const links = data?.links || []
  const coupons = data?.coupons || []
  const referrals = data?.referrals || []
  const payouts = data?.payouts || []
  const activity = data?.activity || []

  const linkStats = useMemo(() => {
    let clicks = 0
    let created = 0
    let success = 0
    let commission = 0
    for (const l of links) {
      clicks += Number(l.clicks || 0)
      created += Number(l.paymentsCreated || 0)
      success += Number(l.paymentsSuccess || 0)
      commission += Number(l.earnings || 0)
    }
    const revenue = Number(stats.totalSales || 0)
    return { clicks, created, success, commission, revenue }
  }, [links, stats.totalSales])

  const couponStats = useMemo(() => {
    let applied = 0
    let success = 0
    let commission = 0
    let revenue = 0
    for (const c of coupons) {
      applied += Number(c.appliedCount || 0)
      success += Number(c.successCount || 0)
      commission += Number(c.earnings || 0)
      revenue += Number(c.netRevenue || 0)
    }
    const created = Math.max(applied, success)
    return {
      applied,
      uniqueStudents: success,
      paymentsCreated: created,
      successful: success,
      revenue,
      commission,
    }
  }, [coupons])

  const refPages = Math.max(1, Math.ceil(referrals.length / REF_PER_PAGE))
  const refSlice = referrals.slice((refPage - 1) * REF_PER_PAGE, refPage * REF_PER_PAGE)
  const referralNet = Number(stats.referralNetPaid || 0)
  const couponNet = Number(stats.couponNetPaid || 0)
  const referralCommissionAmt = Number(stats.referralCommission || linkStats.commission)
  const couponCommissionAmt = Number(stats.couponCommission || couponStats.commission)

  const bank = (p.bank || {}) as Record<string, string>
  const bankLine = bank.accountNumber
    ? `${bank.bankName || 'Bank'} account ending in ${bank.accountNumber.slice(-4)}`
    : p.upiId
      ? `UPI · ${String(p.upiId)}`
      : 'Not provided'

  const saveProfile = async () => {
    if (!id) return
    setSaving(true)
    try {
      await adminPartnerService.updatePartner(id, { status, notes })
      reload()
    } finally {
      setSaving(false)
    }
  }

  const suspendPartner = async () => {
    if (!id || !window.confirm('Suspend this partner account?')) return
    await adminPartnerService.updatePartner(id, { status: 'suspended' })
    setActionsOpen(false)
    reload()
  }

  if (loading && !data) {
    return <p className="text-sm text-slate-gray">Loading partner…</p>
  }
  if (!data) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center">
        <p className="text-sm text-slate-gray">Partner not found.</p>
        <Link to="/admin/partners" className="mt-3 inline-block text-sm font-semibold text-brand-accent hover:underline">
          Back to all partners
        </Link>
      </div>
    )
  }

  const name = String(p.fullName || 'Partner')
  const ini = partnerInitials(name)
  const isActive = String(p.status).toLowerCase() === 'active'
  const pct = Number(p.commissionPercent || 0)

  return (
    <div className="space-y-5 pb-10">
      <Link to="/admin/partners" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to all partners
      </Link>

      <SectionCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4 min-w-0">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-accent text-xl font-bold text-white">
              {ini}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-[#0f172a]">{name}</h1>
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active partner
                  </span>
                ) : (
                  <AdminStatusBadge status={String(p.status)} />
                )}
              </div>
              <p className="mt-1 text-sm text-slate-gray">
                {String(p.partnerCode)} · {String(p.partnerType || 'Partner')} partner · Joined {fmtDate(String(p.createdAt))}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTab('profile')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" /> Edit partner
            </button>
            <a
              href={`mailto:${p.email}?subject=XpertIntern Partner`}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
            >
              <Mail className="h-4 w-4" /> Send message
            </a>
            <div className="relative">
              <button
                type="button"
                onClick={() => setActionsOpen((o) => !o)}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                <MoreHorizontal className="h-4 w-4" /> Actions <ChevronDown className="h-4 w-4" />
              </button>
              {actionsOpen ? (
                <>
                  <button type="button" className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} aria-label="Close" />
                  <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                    <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-gray">Partner actions</p>
                    <button type="button" onClick={() => { setTab('performance'); setActionsOpen(false) }} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                      <TrendingUp className="h-4 w-4" /> View performance
                    </button>
                    <button type="button" onClick={() => void suspendPartner()} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                      <PauseCircle className="h-4 w-4" /> Suspend account
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" /> Delete partner
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap gap-1 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
        {TABS.map(({ id: t, label }) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t ? 'bg-brand-accent text-white' : 'text-slate-gray hover:bg-gray-50 hover:text-[#0f172a]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel
            title="Partner information"
            action={
              <button type="button" onClick={() => void saveProfile()} className="text-xs font-semibold text-brand-accent hover:underline">
                Edit
              </button>
            }
          >
            <InfoRow icon={Mail} label="Email" value={String(p.email)} />
            <InfoRow icon={Phone} label="Phone number" value={String(p.phone)} />
            <InfoRow icon={User} label="Partner type" value={String(p.partnerType)} />
            <InfoRow icon={Building2} label="Organisation" value={String(p.organisationName || 'Not provided')} />
            <InfoRow icon={MapPin} label="City & state" value={[p.city, p.state].filter(Boolean).join(', ') || '—'} />
            <InfoRow icon={Calendar} label="Joined on" value={fmtDate(String(p.createdAt))} />
          </Panel>

          <Panel title="Commercial settings">
            <div className="rounded-xl bg-brand-accent p-5 text-white mb-4">
              <p className="text-xs text-white/60">Default commission</p>
              <p className="mt-1 text-3xl font-bold">{pct}%</p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-gray">Account status</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {isActive ? 'Active' : String(p.status)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-gray">Login access</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {isActive ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            {!isActive ? null : (
              <button
                type="button"
                onClick={() => void suspendPartner()}
                className="mt-5 w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Suspend partner account
              </button>
            )}
          </Panel>

          <Panel
            title="Payout details"
            action={
              <button type="button" className="text-xs font-semibold text-brand-accent hover:underline">
                Edit
              </button>
            }
          >
            <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
              <CreditCard className="h-5 w-5 shrink-0 text-brand-accent mt-0.5" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-gray">Primary payout method</p>
                <p className="mt-1 text-sm font-semibold text-[#0f172a]">{bankLine}</p>
                {bank.accountNumber ? (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </span>
                ) : null}
              </div>
            </div>
            {p.pan ? <InfoRow icon={FileText} label="PAN number" value={String(p.pan)} /> : null}
            {p.upiId ? <InfoRow icon={Wallet} label="UPI ID" value={String(p.upiId)} /> : null}
            {p.bankPendingApproval ? (
              <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Pending bank/UPI change — requires approval</p>
                {(() => {
                  const pending = (p.bankPendingApproval || {}) as Record<string, unknown>
                  const pendingBank = (pending.bank || {}) as Record<string, string>
                  return (
                    <div className="text-xs text-amber-900 space-y-1">
                      {pending.upiId ? <p>UPI: {String(pending.upiId)}</p> : null}
                      {pendingBank.accountNumber ? (
                        <p>
                          Bank: {pendingBank.bankName || 'Bank'} · ****{pendingBank.accountNumber.slice(-4)} · {pendingBank.ifsc}
                        </p>
                      ) : null}
                    </div>
                  )
                })()}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={async () => {
                      if (!id) return
                      await adminPartnerService.updatePartner(id, { approveBank: true })
                      showAppToast('Bank details approved')
                      reload()
                    }}
                  >
                    Approve change
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
                    onClick={async () => {
                      if (!id) return
                      await adminPartnerService.updatePartner(id, { rejectBank: true })
                      showAppToast('Bank change rejected')
                      reload()
                    }}
                  >
                    Reject change
                  </button>
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel title="Internal notes">
            <textarea
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm min-h-[120px]"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes visible only to administrators…"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveProfile()}
                className="rounded-xl bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
              >
                Save note
              </button>
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === 'links' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0f172a]">Referral links</h2>
              <p className="text-sm text-slate-gray">Trackable links for this partner.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" /> Create referral link
            </button>
          </div>
          {links.map((l) => {
            const rev = Number(l.netRevenue || 0)
            return (
              <SectionCard key={String(l.id)}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                      {l.linkType === 'training' ? <GraduationCap className="h-5 w-5 text-orange-500" /> : <Link2 className="h-5 w-5 text-brand-accent" />}
                    </div>
                    <div>
                      <p className="font-bold text-[#0f172a]">{String(l.label)}</p>
                      <p className="text-xs text-slate-gray capitalize">{String(l.linkType || '').replace('_', ' ')}{l.trainingTitle ? ` · ${l.trainingTitle}` : ''}</p>
                    </div>
                  </div>
                  {l.active !== false ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
                  ) : (
                    <AdminStatusBadge status="inactive" />
                  )}
                </div>
                <CopyField value={String(l.url)} />
                <div className="mt-4 flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-slate-gray">
                        <th className="pb-2 pr-4">Clicks</th>
                        <th className="pb-2 pr-4">Payment created</th>
                        <th className="pb-2 pr-4">Successful</th>
                        <th className="pb-2 pr-4">Revenue</th>
                        <th className="pb-2">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="font-semibold text-[#0f172a]">
                        <td className="py-1 pr-4">{Number(l.clicks || 0).toLocaleString()}</td>
                        <td className="py-1 pr-4">{Number(l.paymentsCreated || 0)}</td>
                        <td className="py-1 pr-4">{Number(l.paymentsSuccess || 0)}</td>
                        <td className="py-1 pr-4">{fmtInr(rev)}</td>
                        <td className="py-1">{fmtInr(Number(l.earnings || 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl border bg-gray-50 p-2">
                    <img src={qrUrl(String(l.url), 96)} alt="" className="rounded bg-white" width={96} height={96} />
                    <span className="text-[10px] text-slate-gray">QR code</span>
                  </div>
                </div>
                {l.commissionOverride != null && l.commissionOverride !== '' ? (
                  <p className="mt-2 text-[11px] text-slate-gray">Commission override: {Number(l.commissionOverride)}%</p>
                ) : null}
                <p className="mt-3 text-[11px] text-slate-gray">
                  Created {String(l.createdAt || '—')}
                  {l.validTill ? ` · Valid until ${String(l.validTill)}` : ' · No expiry'}
                </p>
              </SectionCard>
            )
          })}
          {!links.length ? <p className="text-sm text-slate-gray">No referral links yet.</p> : null}
        </div>
      ) : null}

      {tab === 'coupons' ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0f172a]">Coupon performance</h2>
              <p className="text-sm text-slate-gray">Usage and revenue from partner coupon codes.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCouponModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" /> Create coupon
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard label="Coupon applications" value={couponStats.applied} sub={`${couponStats.uniqueStudents} unique students`} icon={Gift} iconBg="bg-blue-50" iconColor="text-brand-accent" />
            <AdminStatCard label="Payments created" value={couponStats.paymentsCreated} sub={couponStats.applied ? `${Math.round((couponStats.paymentsCreated / couponStats.applied) * 1000) / 10}% of applications` : '—'} icon={CreditCard} iconBg="bg-violet-50" iconColor="text-violet-600" />
            <AdminStatCard label="Successful purchases" value={couponStats.successful} sub={couponStats.paymentsCreated ? `${Math.round((couponStats.successful / couponStats.paymentsCreated) * 1000) / 10}% payment success` : '—'} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
            <AdminStatCard label="Coupon revenue" value={fmtInr(couponStats.revenue || Number(stats.totalSales || 0))} sub={`${fmtInr(couponStats.commission)} commission`} icon={IndianRupee} iconBg="bg-orange-50" iconColor="text-orange-600" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {coupons.map((c) => {
              const limit = Number(c.usageLimitTotal || 500)
              const used = Number(c.appliedCount || c.successCount || 0)
              const pctUsed = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
              const discountLabel = c.discountType === 'flat' ? fmtInr(Number(c.discountValue || 0)) : `${Number(c.discountValue || 0)}%`
              return (
                <SectionCard key={String(c.id)} className="border-l-4 border-l-brand-accent">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-mono text-lg font-bold text-[#0f172a]">{String(c.code)}</p>
                      <p className="text-sm font-semibold text-brand-accent">{discountLabel} OFF</p>
                    </div>
                    <CopyField value={String(c.code)} />
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-slate-gray mb-1">
                      <span>{used}/{limit || '∞'} applied</span>
                      <span>{pctUsed}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand-accent" style={{ width: `${pctUsed}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                    {[
                      ['Applied', used],
                      ['Payment created', Number(c.appliedCount || 0)],
                      ['Successful', Number(c.successCount || 0)],
                      ['Revenue', fmtInr(Number(c.netRevenue || 0))],
                      ['Commission', fmtInr(Number(c.earnings || 0))],
                    ].map(([lbl, val]) => (
                      <div key={String(lbl)}>
                        <p className="text-slate-gray">{lbl}</p>
                        <p className="font-bold text-[#0f172a] mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-slate-gray">
                    Valid for {c.trainingScope === 'all' ? 'All trainings' : c.trainingScope === 'one' ? 'One training' : 'Selected trainings'}
                    {c.validTill ? ` until ${String(c.validTill)}` : ''}
                    {c.commissionOverride != null && c.commissionOverride !== '' ? ` · Commission ${Number(c.commissionOverride)}%` : ''}
                    {c.active !== false ? ' · Active' : ' · Inactive'}
                  </p>
                </SectionCard>
              )
            })}
          </div>
          {!coupons.length ? <p className="text-sm text-slate-gray">No coupons yet.</p> : null}
        </div>
      ) : null}

      {tab === 'performance' ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard label="Payments created" value={Number(stats.paymentsCreated || 0)} sub={`${Number(stats.successfulReferrals || 0)} successful`} icon={CreditCard} iconBg="bg-blue-50" iconColor="text-brand-accent" />
            <AdminStatCard label="Successful payments" value={Number(stats.successfulReferrals || 0)} sub={`${Number(stats.conversionRate || 0)}% success rate`} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
            <AdminStatCard label="Total attributed revenue" value={fmtInr(Number(stats.totalSales || 0))} icon={IndianRupee} iconBg="bg-orange-50" iconColor="text-orange-600" />
            <AdminStatCard label="Commission earned" value={fmtInr(Number(stats.totalEarnings || 0))} icon={Wallet} iconBg="bg-violet-50" iconColor="text-violet-600" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h3 className="font-bold text-[#0f172a] mb-1">Referral link revenue</h3>
              <p className="text-2xl font-bold text-brand-accent mb-4">{fmtInr(referralNet)}</p>
              <p className="text-xs text-slate-gray mb-3">{fmtInr(referralCommissionAmt)} commission from referral links</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {[['Clicks', linkStats.clicks], ['Payments created', linkStats.created], ['Successful paid', linkStats.success], ['Commission', fmtInr(linkStats.commission)]].map(([lbl, val]) => (
                  <div key={String(lbl)}>
                    <p className="text-slate-gray">{lbl}</p>
                    <p className="font-bold mt-1">{val}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
            <SectionCard>
              <h3 className="font-bold text-[#0f172a] mb-1">Coupon code revenue</h3>
              <p className="text-2xl font-bold text-orange-600 mb-4">{fmtInr(couponNet || couponStats.revenue)}</p>
              <p className="text-xs text-slate-gray mb-3">{fmtInr(couponCommissionAmt)} commission from coupons</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {[['Coupons applied', couponStats.applied], ['Payments created', couponStats.paymentsCreated], ['Successful paid', couponStats.successful], ['Commission', fmtInr(couponStats.commission)]].map(([lbl, val]) => (
                  <div key={String(lbl)}>
                    <p className="text-slate-gray">{lbl}</p>
                    <p className="font-bold mt-1">{val}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2">
              <h3 className="font-bold text-[#0f172a] mb-4">Clicks and conversions</h3>
              <BarChart points={Array.isArray(stats.chartClicks) ? stats.chartClicks.slice(-7) : []} />
            </SectionCard>
            <SectionCard>
              <h3 className="font-bold text-[#0f172a] mb-4">Payment funnel</h3>
              <div className="space-y-4">
                <FunnelRow label="Clicks + coupon applications" value={Number(stats.totalClicks || 0) + couponStats.applied} pct={100} color="#2563eb" />
                <FunnelRow label="Payments created" value={Number(stats.paymentsCreated || 0)} pct={Number(stats.paymentsCreated || 0) ? 72 : 20} color="#f59e0b" />
                <FunnelRow label="Successful payments" value={Number(stats.successfulReferrals || 0)} pct={Number(stats.conversionRate || 0) || 40} color="#10b981" />
                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <p className="text-xs text-emerald-800">Attributed revenue</p>
                  <p className="text-xl font-bold text-emerald-900">{fmtInr(Number(stats.totalSales || 0))}</p>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-accent">Admin-only student data</p>
                <h3 className="text-lg font-bold text-[#0f172a]">Attributed student payments</h3>
                <p className="text-sm text-slate-gray">Students who paid through this partner&apos;s links or coupons.</p>
              </div>
              <button
                type="button"
                onClick={() => id && void adminPartnerService.exportPartnerReferrals(id)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                <Download className="h-4 w-4" /> Export students
              </button>
            </div>
            <AdminInfoBanner>
              Full contact details are visible only to authorised admins. Partner-facing screens must show masked student data.
            </AdminInfoBanner>
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-gray">
                    <th className="pb-3 pr-4">Student</th>
                    <th className="pb-3 pr-4">College & university</th>
                    <th className="pb-3 pr-4">Contact details</th>
                    <th className="pb-3 pr-4">Source</th>
                    <th className="pb-3 pr-4">Training</th>
                    <th className="pb-3 pr-4">Payment</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Commission</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {refSlice.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-gray-50/50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent/10 text-xs font-bold text-brand-accent">
                            {partnerInitials(String(r.studentName))}
                          </div>
                          <div>
                            <p className="font-semibold text-[#0f172a]">{String(r.studentName)}</p>
                            <p className="text-[10px] text-slate-gray">{String(r.date)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-gray max-w-[10rem]">
                        {[r.college, r.university].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <p>{String(r.studentEmail || '—')}</p>
                        <p className="text-slate-gray">{String(r.studentPhone || '')}</p>
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <span className="inline-flex items-center gap-1 font-medium">
                          {String(r.source) === 'Coupon' ? <Gift className="h-3.5 w-3.5 text-orange-500" /> : <Link2 className="h-3.5 w-3.5 text-brand-accent" />}
                          {String(r.source)}
                        </span>
                        {r.sourceDetail ? <p className="text-[10px] text-slate-gray mt-0.5">{String(r.sourceDetail)}</p> : null}
                      </td>
                      <td className="py-3 pr-4 text-xs max-w-[8rem]">{String(r.training || '—')}</td>
                      <td className="py-3 pr-4 font-semibold">{fmtInr(Number(r.amount || 0))}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${String(r.status) === 'Successful' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                          {String(r.status)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-semibold">{Number(r.commission || 0) > 0 ? fmtInr(Number(r.commission)) : '—'}</td>
                      <td className="py-3">
                        <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-accent hover:underline">
                          <Eye className="h-3.5 w-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!referrals.length ? <p className="py-8 text-center text-sm text-slate-gray">No attributed payments yet.</p> : null}
            </div>
            {referrals.length > REF_PER_PAGE ? (
              <div className="mt-4 flex items-center justify-between text-xs text-slate-gray">
                <span>Showing {(refPage - 1) * REF_PER_PAGE + 1}–{Math.min(refPage * REF_PER_PAGE, referrals.length)} of {referrals.length} payment records</span>
                <div className="flex gap-1">
                  <button type="button" disabled={refPage <= 1} onClick={() => setRefPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Previous</button>
                  {Array.from({ length: Math.min(refPages, 3) }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" onClick={() => setRefPage(n)} className={`rounded border px-2 py-1 ${refPage === n ? 'bg-brand-accent text-white border-brand-accent' : ''}`}>{n}</button>
                  ))}
                  <button type="button" disabled={refPage >= refPages} onClick={() => setRefPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Next</button>
                </div>
              </div>
            ) : null}
          </SectionCard>
        </div>
      ) : null}

      {tab === 'payouts' ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0f172a]">Earnings and payouts</h2>
              <p className="text-sm text-slate-gray">Commission status and payment history for this partner.</p>
            </div>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50">
              <Download className="h-4 w-4" /> Download statement
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <AdminStatCard label="Pending payout" value={fmtInr(Number(stats.pendingPayout || 0))} sub={Number(stats.pendingPayout || 0) >= 500 ? 'Eligible for processing' : 'Below minimum ₹500'} icon={PARTNER_STAT_ICONS.pending.icon} iconBg="bg-orange-50" iconColor="text-orange-600" />
            <AdminStatCard label="In hold period" value={fmtInr(Number(stats.holdAmount || 0))} sub={`${Number(stats.holdDays || 15)}-day review window`} icon={Zap} iconBg="bg-violet-50" iconColor="text-violet-600" />
            <AdminStatCard label="Total paid" value={fmtInr(Number(stats.paidOut || 0))} sub={`${payouts.length} completed payout${payouts.length !== 1 ? 's' : ''}`} icon={PARTNER_STAT_ICONS.paid.icon} iconBg={PARTNER_STAT_ICONS.paid.bg} iconColor={PARTNER_STAT_ICONS.paid.color} />
          </div>
          {payouts[0] ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 px-5 py-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-brand-accent" />
                <p className="text-sm">
                  Latest payout: <strong>{fmtInr(Number(payouts[0].amount || 0))}</strong> processed on {String(payouts[0].date)} via {String(payouts[0].method || 'bank transfer')}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Paid</span>
                <button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
                  <Download className="h-3.5 w-3.5 inline mr-1" /> Receipt
                </button>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            {payouts.map((po) => (
              <div key={String(po.payoutId)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">{String(po.payoutId)}</p>
                  <p className="text-xs text-slate-gray">{String(po.date)} · {String(po.method)} · UTR {String(po.transactionRef)}</p>
                </div>
                <p className="font-bold">{fmtInr(Number(po.amount || 0))}</p>
              </div>
            ))}
            {!payouts.length ? <p className="text-sm text-slate-gray">No payouts processed yet.</p> : null}
          </div>
          {Number(stats.pendingPayout || 0) >= 500 ? (
            <button
              type="button"
              onClick={() => navigate('/admin/partners/payouts')}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
            >
              <Banknote className="h-4 w-4" /> Process payout in bulk queue
            </button>
          ) : null}
        </div>
      ) : null}

      {tab === 'activity' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0f172a]">Activity log</h2>
              <p className="text-sm text-slate-gray">Complete audit trail for partner and admin actions.</p>
            </div>
            <span className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-gray">All activity</span>
          </div>
          <SectionCard className="divide-y divide-gray-50 p-0 overflow-hidden">
            {activity.map((a, i) => {
              const meta = (a.meta || {}) as Record<string, unknown>
              const Icon = activityIcon(String(a.action))
              return (
                <div key={i} className="flex gap-4 px-5 py-4 hover:bg-gray-50/50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                    <Icon className="h-5 w-5 text-brand-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#0f172a]">{activityLabel(String(a.action), meta)}</p>
                      {i === 0 ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-brand-accent">Latest</span> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-gray">{String(a.createdAt)}</p>
                  </div>
                </div>
              )
            })}
            {!activity.length ? <p className="p-8 text-center text-sm text-slate-gray">No activity logged yet.</p> : null}
          </SectionCard>
        </div>
      ) : null}

      {id && data ? (
        <>
          <CreatePartnerLinkModal
            open={showLinkModal}
            partnerId={id}
            partner={data.partner}
            trainings={trainings}
            onClose={() => setShowLinkModal(false)}
            onCreated={() => {
              showAppToast('Referral link created')
              reload()
            }}
          />
          <CreatePartnerCouponModal
            open={showCouponModal}
            partnerId={id}
            partner={data.partner}
            trainings={trainings}
            onClose={() => setShowCouponModal(false)}
            onCreated={() => {
              showAppToast('Coupon created')
              reload()
            }}
          />
        </>
      ) : null}
    </div>
  )
}
