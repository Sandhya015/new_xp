import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap,
  Users,
  Gift,
  IndianRupee,
  Wallet,
  Link2,
  User,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle2,
  Download,
  Plus,
  QrCode,
  Share2,
  BarChart3,
  Shield,
  Calendar,
  Mail,
  MessageCircle,
  ChevronDown,
  Search,
  Send,
  Eye,
  FileText,
  Image,
  Video,
  Palette,
  BookOpen,
} from 'lucide-react'
import { partnerService } from '@/services/partnerService'
import { useAuthStore } from '@/store/authStore'
import { usePartner } from '@/context/PartnerContext'
import {
  PageHeader,
  StatCard,
  StatusBadge,
  CopyField,
  BarChart,
  FunnelRow,
  EmptyState,
  SectionCard,
  fmtInr,
  partnerInitials,
  SplitBarChart,
  shareWhatsApp,
  qrUrl,
} from '@/components/partner/PartnerUI'

function num(stats: Record<string, unknown>, k: string) {
  return Number(stats[k] ?? 0)
}

function chartPoints(stats: Record<string, unknown>, k: string) {
  const v = stats[k]
  return Array.isArray(v) ? (v as Array<{ date: string; value: number }>) : []
}

// ── Overview ────────────────────────────────────────────────────────────────

export function PartnerOverview() {
  const { partner, stats, loading } = usePartner()
  const [mainUrl, setMainUrl] = useState('')
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([])
  const [coupons, setCoupons] = useState<Array<Record<string, unknown>>>([])
  const [recentRefs, setRecentRefs] = useState<Array<Record<string, unknown>>>([])

  useEffect(() => {
    partnerService.links().then((r) => {
      const items = r.items || []
      setLinks(items)
      const first = items[0]
      if (first?.url) setMainUrl(String(first.url))
    }).catch(() => undefined)
    partnerService.coupons().then((r) => setCoupons(r.items || [])).catch(() => undefined)
    partnerService.referrals().then((r) => setRecentRefs((r.items || []).slice(0, 5))).catch(() => undefined)
  }, [])

  if (loading) {
    return <p className="text-sm text-slate-gray">Loading your dashboard…</p>
  }

  const s = stats as Record<string, unknown>
  const name = String(partner?.fullName || 'Partner').split(' ')[0]
  const monthEarn = num(s, 'thisMonthEarnings')
  const monthSuccess = num(s, 'thisMonthSuccessful')
  const totalSales = num(s, 'totalSales')
  const goal = Math.max(monthEarn * 1.4, 7000)
  const goalPct = Math.min(100, Math.round((monthEarn / goal) * 100))
  const monthNet = num(s, 'monthNetPaid') || totalSales
  const earnReferral = chartPoints(s, 'chartReferralEarnings')
  const earnCoupon = chartPoints(s, 'chartCouponEarnings')
  const clicks = num(s, 'totalClicks')
  const paymentsCreated = num(s, 'paymentsCreated')
  const successful = num(s, 'successfulReferrals')
  const convRate = num(s, 'conversionRate')
  const funnelTop = clicks + num(s, 'signups')
  const topLinks = [...links].sort((a, b) => Number(b.earnings || 0) - Number(a.earnings || 0)).slice(0, 3)
  const topCoupons = [...coupons].sort((a, b) => Number(b.earnings || 0) - Number(a.earnings || 0)).slice(0, 3)
  const emailShare = mainUrl ? `mailto:?subject=${encodeURIComponent('XpertIntern internship trainings')}&body=${encodeURIComponent(`Hi,\n\nExplore XpertIntern trainings using my link:\n${mainUrl}\n\nThanks!`)}` : ''

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="Overview" />

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#1e40af] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-200">Welcome back, {name.toUpperCase()}</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Turn your reach into real earnings.</h2>
            <p className="mt-2 text-sm text-blue-100">
              Your links and coupons generated {fmtInr(monthNet)} in student payments this month.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {mainUrl ? (
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(mainUrl)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#1d4ed8] hover:bg-blue-50"
                >
                  Copy main link
                </button>
              ) : null}
              {mainUrl ? (
                <button
                  type="button"
                  onClick={() => shareWhatsApp(`Join XpertIntern trainings: ${mainUrl}`)}
                  className="rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Share on WhatsApp
                </button>
              ) : null}
              {emailShare ? (
                <a href={emailShare} className="rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                  Send by email
                </a>
              ) : null}
              <Link to="/partner/payouts" className="rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                Monthly report
              </Link>
            </div>
          </div>
          <div className="w-full max-w-xs rounded-2xl bg-white/10 p-5 backdrop-blur-sm border border-white/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-200">Your earnings this month</p>
            <p className="mt-2 text-3xl font-bold">{fmtInr(monthEarn)}</p>
            {monthSuccess > 0 ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5" /> {monthSuccess} successful referral{monthSuccess !== 1 ? 's' : ''} this month
              </p>
            ) : null}
            <div className="mt-4">
              <div className="flex justify-between text-[10px] text-blue-200 mb-1">
                <span>Progress</span>
                <span>{fmtInr(goal)} goal</span>
              </div>
              <div className="h-2 rounded-full bg-white/20">
                <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${goalPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-accent">Performance snapshot</p>
            <p className="text-sm text-slate-gray">Revenue and commission from referral links and coupon codes.</p>
          </div>
          <span className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-slate-gray">Last 30 days</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total clicks" value={clicks.toLocaleString()} sub={`+${num(s, 'thisMonthSuccessful')} referrals this month`} icon={Zap} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <StatCard label="Successful referrals" value={successful} sub={`${monthSuccess} this month`} icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Conversion rate" value={`${convRate}%`} sub="Successful ÷ payments created" icon={BarChart3} iconBg="bg-orange-50" iconColor="text-orange-600" />
          <StatCard label="Total earnings" value={fmtInr(num(s, 'totalEarnings'))} sub={`${fmtInr(monthEarn)} this month`} icon={IndianRupee} iconBg="bg-violet-50" iconColor="text-violet-600" />
          <StatCard label="Pending payout" value={fmtInr(num(s, 'pendingPayout'))} sub={`${fmtInr(num(s, 'holdAmount'))} in hold`} icon={Wallet} iconBg="bg-slate-100" iconColor="text-slate-700" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard>
          <p className="text-sm font-semibold text-[#0f172a] mb-4">Earnings trend — referral links vs coupons</p>
          <SplitBarChart referral={earnReferral} coupon={earnCoupon} />
        </SectionCard>
        <SectionCard>
          <p className="text-sm font-semibold text-[#0f172a] mb-4">Conversion funnel</p>
          <div className="space-y-4">
            <FunnelRow label="Link clicks + signups" value={funnelTop.toLocaleString()} pct={100} color="#2563eb" />
            <FunnelRow label="Payments created" value={paymentsCreated} pct={funnelTop ? (paymentsCreated / funnelTop) * 100 : 0} color="#7c3aed" />
            <FunnelRow label="Successful payments" value={successful} pct={paymentsCreated ? (successful / paymentsCreated) * 100 : 0} color="#059669" />
            <FunnelRow label="Conversion rate" value={`${convRate}%`} pct={convRate} color="#ea580c" />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard>
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#0f172a]">Top referral links</p>
            <Link to="/partner/links" className="text-xs font-semibold text-brand-accent hover:underline">View all</Link>
          </div>
          {topLinks.length ? (
            <div className="space-y-3">
              {topLinks.map((l) => (
                <div key={String(l.id)} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0f172a] truncate">{String(l.label)}</p>
                    <p className="text-xs text-slate-gray">{Number(l.clicks || 0)} clicks · {Number(l.paymentsSuccess || 0)} paid</p>
                  </div>
                  <p className="shrink-0 font-bold text-emerald-600">{fmtInr(Number(l.earnings || 0))}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-gray">No links yet — request one from Support.</p>
          )}
        </SectionCard>
        <SectionCard>
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#0f172a]">Top coupon codes</p>
            <Link to="/partner/coupons" className="text-xs font-semibold text-brand-accent hover:underline">View all</Link>
          </div>
          {topCoupons.length ? (
            <div className="space-y-3">
              {topCoupons.map((c) => (
                <div key={String(c.id)} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0f172a]">{String(c.code)}</p>
                    <p className="text-xs text-slate-gray">{Number(c.appliedCount || 0)} applied · {Number(c.successCount || 0)} paid</p>
                  </div>
                  <p className="shrink-0 font-bold text-emerald-600">{fmtInr(Number(c.earnings || 0))}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-gray">No coupons yet — request one from Support.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard className="p-0 overflow-hidden">
        <p className="px-5 pt-5 text-sm font-semibold text-[#0f172a]">Recent partner activity</p>
        <div className="mt-3 divide-y divide-gray-100">
          {recentRefs.length ? recentRefs.map((r) => (
            <div key={String(r.id)} className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                {r.couponCode ? <Gift className="h-4 w-4 text-orange-500" /> : <Link2 className="h-4 w-4 text-brand-accent" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#0f172a]">
                  {r.couponCode ? `Coupon ${String(r.couponCode)} used` : 'New referral'} — {String(r.training || 'Training')}
                </p>
                <p className="text-xs text-slate-gray">{String(r.studentName)} · {String(r.date)}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-emerald-600">{fmtInr(Number(r.commission || 0))}</p>
            </div>
          )) : (
            <p className="p-8 text-center text-sm text-slate-gray">Share your link or coupon to start earning commissions.</p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// ── Links ───────────────────────────────────────────────────────────────────

export function PartnerLinks() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    partnerService.links().then((r) => setItems(r.items || [])).catch(() => setItems([])).finally(() => setLoading(false))
  }, [])

  const summary = useMemo(() => {
    const active = items.filter((l) => l.active).length
    const clicks = items.reduce((a, l) => a + Number(l.clicks || 0), 0)
    const unique = items.reduce((a, l) => a + Number(l.uniqueVisitors || 0), 0)
    const created = items.reduce((a, l) => a + Number(l.paymentsCreated || 0), 0)
    const paid = items.reduce((a, l) => a + Number(l.paymentsSuccess || 0), 0)
    const earnings = items.reduce((a, l) => a + Number(l.earnings || 0), 0)
    const revenue = items.reduce((a, l) => a + Number(l.netRevenue || 0), 0)
    return { active, clicks, unique, created, paid, earnings, revenue, uniquePct: clicks ? Math.round((unique / clicks) * 1000) / 10 : 0 }
  }, [items])

  if (loading) return <p className="text-sm text-slate-gray">Loading links…</p>

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Promotion sources"
        title="My referral links"
        subtitle="Share your unique links and track every click, payment and successful enrollment."
        action={
          <Link to="/partner/support" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0f172a] shadow-sm hover:bg-gray-50">
            <Plus className="h-4 w-4" /> Request a new link
          </Link>
        }
      />

      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active links" value={summary.active} sub="All links are healthy" icon={Link2} />
          <StatCard label="Unique visitors" value={summary.unique.toLocaleString()} sub={`${summary.uniquePct}% of clicks`} icon={User} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Payments created" value={summary.created} sub={`${summary.paid} successfully paid`} icon={CreditCard} iconBg="bg-violet-50" iconColor="text-violet-600" />
          <StatCard label="Link earnings" value={fmtInr(summary.earnings)} sub={`${fmtInr(summary.revenue)} attributed revenue`} icon={IndianRupee} iconBg="bg-blue-50" iconColor="text-blue-600" />
        </div>
      ) : null}

      {!items.length ? (
        <EmptyState
          title="No referral links yet"
          body="Raise a support request and our team will assign your first promotion link."
          action={
            <Link to="/partner/support" className="inline-flex rounded-xl bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
              Contact support
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((l) => {
            const url = String(l.url || '')
            const revenue = Number(l.netRevenue || 0)
            return (
              <SectionCard key={String(l.id)} className="p-0 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-[#0f172a]">{String(l.label)}</h3>
                      <p className="text-sm text-slate-gray capitalize">
                        {String(l.linkType || '').replace('_', '-')} referral link
                        {l.trainingTitle ? ` · ${String(l.trainingTitle)}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={l.active ? 'Active' : 'Inactive'} />
                  </div>
                  <div className="mt-4">
                    <CopyField value={url.replace(/^https?:\/\//, '')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 bg-gray-50/50">
                  {(
                    [
                      ['Clicks', String(l.clicks)],
                      ['Unique', String(l.uniqueVisitors)],
                      ['Payments', String(l.paymentsCreated)],
                      ['Successful', String(l.paymentsSuccess)],
                      ['Revenue', fmtInr(revenue)],
                      ['Your earnings', fmtInr(Number(l.earnings || 0))],
                    ] as [string, string][]
                  ).map(([label, val]) => (
                    <div key={label} className="px-4 py-3 text-center">
                      <p className="text-[10px] font-semibold uppercase text-slate-gray">{label}</p>
                      <p className={`mt-1 text-sm font-bold ${label === 'Your earnings' ? 'text-emerald-600' : 'text-[#0f172a]'}`}>{String(val)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-gray-100">
                  <p className="text-[11px] text-slate-gray">
                    {l.validTill ? `Valid until ${String(l.validTill)}` : 'No expiry'} · Commission after successful payment
                  </p>
                  <div className="flex items-center gap-2">
                    <a href={qrUrl(url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50">
                      <QrCode className="h-3.5 w-3.5" /> QR code
                    </a>
                    <button type="button" onClick={() => shareWhatsApp(`Check out XpertIntern: ${url}`)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50">
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                    <Link to="/partner/referrals" className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50">
                      <BarChart3 className="h-3.5 w-3.5" /> View stats
                    </Link>
                  </div>
                </div>
              </SectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Coupons ─────────────────────────────────────────────────────────────────

export function PartnerCoupons() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    partnerService.coupons().then((r) => setItems(r.items || [])).catch(() => setItems([])).finally(() => setLoading(false))
  }, [])

  const summary = useMemo(() => {
    const applied = items.reduce((a, c) => a + Number(c.appliedCount || 0), 0)
    const success = items.reduce((a, c) => a + Number(c.successCount || 0), 0)
    const discount = items.reduce((a, c) => a + Number(c.totalDiscount || 0), 0)
    const earnings = items.reduce((a, c) => a + Number(c.earnings || 0), 0)
    const revenue = items.reduce((a, c) => a + Number(c.netRevenue || 0), 0)
    return { applied, success, discount, earnings, revenue }
  }, [items])

  const couponDesc = (c: Record<string, unknown>) => {
    if (c.discountType === 'flat') return `₹${c.discountValue} OFF`
    return `${c.discountValue}% OFF`
  }

  const couponScope = (c: Record<string, unknown>) => {
    const scope = String(c.trainingScope || 'all').toLowerCase()
    if (scope === 'all') return 'All internship trainings'
    if (c.trainingTitle) return String(c.trainingTitle)
    return 'Selected trainings only'
  }

  if (loading) return <p className="text-sm text-slate-gray">Loading coupons…</p>

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="My coupon codes"
        title="My Coupons"
        subtitle="Track coupon applications, payments and commission on every successful purchase."
        action={
          <Link to="/partner/support" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-50">
            <Plus className="h-4 w-4" /> Request a coupon
          </Link>
        }
      />

      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Coupon applications" value={summary.applied} sub="Across all codes" icon={Gift} />
          <StatCard label="Successful purchases" value={summary.success} sub="Paid enrollments" icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Total student discount" value={fmtInr(summary.discount)} sub="Given to students" icon={TrendingUp} iconBg="bg-orange-50" iconColor="text-orange-600" />
          <StatCard label="Net paid revenue" value={fmtInr(summary.revenue)} sub="After student discount" icon={CreditCard} iconBg="bg-violet-50" iconColor="text-violet-600" />
          <StatCard label="Your commission" value={fmtInr(summary.earnings)} sub="Calculated on net paid" icon={IndianRupee} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        </div>
      ) : null}

      {!items.length ? (
        <EmptyState title="No coupons assigned" body="Request a coupon code from support to start promoting with discounts." action={<Link to="/partner/support" className="inline-flex rounded-xl bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Request a coupon</Link>} />
      ) : (
        <div className="space-y-4">
          {items.map((c, idx) => {
            const limit = Number(c.usageLimitTotal || 500)
            const applied = Number(c.appliedCount || 0)
            const pct = limit ? Math.min(100, (applied / limit) * 100) : 0
            const stripe = idx % 2 === 0 ? 'border-l-blue-500' : 'border-l-orange-500'
            const netRevenue = Number(c.netRevenue || 0)
            return (
              <SectionCard key={String(c.id)} className={`border-l-4 ${stripe} p-0 overflow-hidden`}>
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-accent">Active coupon</p>
                      <p className="mt-1 text-2xl font-bold tracking-wide text-[#0f172a]">{String(c.code)}</p>
                      <p className="text-sm text-slate-gray">{couponDesc(c)} — {couponScope(c)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.active ? 'Active' : 'Inactive'} />
                      <button type="button" onClick={() => void navigator.clipboard.writeText(String(c.code))} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
                        Copy code
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-gray">Coupon applications</span>
                      <span className="font-semibold">{applied} of {limit || '∞'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    {(
                      [
                        ['Students', String(c.appliedCount)],
                        ['Payments started', String(c.paymentsCreated || c.appliedCount)],
                        ['Payments completed', String(c.successCount)],
                      ] as [string, string][]
                    ).map(([label, val]) => (
                      <div key={label} className="rounded-xl bg-gray-50 py-3">
                        <p className="text-[10px] uppercase text-slate-gray">{label}</p>
                        <p className="mt-1 font-bold text-[#0f172a]">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-100 p-3">
                      <p className="text-[10px] uppercase text-slate-gray">Total student discount</p>
                      <p className="mt-1 font-bold">{fmtInr(Number(c.totalDiscount || 0))}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 p-3">
                      <p className="text-[10px] uppercase text-slate-gray">Net paid revenue</p>
                      <p className="mt-1 font-bold">{fmtInr(netRevenue)}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                      <p className="text-[10px] uppercase text-emerald-700">Your commission</p>
                      <p className="mt-1 font-bold text-emerald-700">{fmtInr(Number(c.earnings || 0))}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 bg-gray-50/30">
                  <p className="text-xs text-slate-gray">{c.validTill ? `Valid until ${String(c.validTill)}` : 'No expiry set'}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => shareWhatsApp(`Use my coupon ${c.code} on XpertIntern!`)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium">
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                    <Link to="/partner/referrals" className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium">
                      <BarChart3 className="h-3.5 w-3.5" /> View stats
                    </Link>
                  </div>
                </div>
              </SectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Referrals ───────────────────────────────────────────────────────────────

function commissionLabel(status: string) {
  const s = status.toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'eligible') return 'Earned'
  if (s === 'earned') return 'Waiting'
  if (s === 'cancelled') return 'Cancelled'
  return status
}

export function PartnerReferrals() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 10

  useEffect(() => {
    partnerService.referrals().then((r) => {
      setItems(r.items || [])
      setStats(r.stats || {})
    }).catch(() => undefined)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((r) => {
      if (q && ![r.training, r.source, r.couponCode, r.studentName].some((v) => String(v || '').toLowerCase().includes(q))) {
        return false
      }
      if (statusFilter && String(r.commissionStatus || '').toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
      if (sourceFilter === 'coupon' && !r.couponCode) return false
      if (sourceFilter === 'link' && r.couponCode) return false
      return true
    })
  }, [items, search, statusFilter, sourceFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage)
  const successful = num(stats as Record<string, unknown>, 'successfulReferrals')
  const paymentsCreated = num(stats as Record<string, unknown>, 'paymentsCreated')
  const conv = paymentsCreated ? Math.round((successful / paymentsCreated) * 1000) / 10 : 0

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Attributed students"
        title="Referral transactions"
        subtitle="Student privacy is protected. Names and emails remain masked in the partner portal."
        action={
          <button
            type="button"
            onClick={() => void partnerService.exportReferrals()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> Export report
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Successful referrals" value={successful} sub={`${fmtInr(num(stats as Record<string, unknown>, 'totalSales'))} net paid`} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard label="Payments created" value={paymentsCreated} sub="All attributed sources" icon={CreditCard} />
        <StatCard label="Refunded" value={num(stats as Record<string, unknown>, 'refundedCount')} sub="Commission cancelled" icon={TrendingUp} iconBg="bg-orange-50" iconColor="text-orange-600" />
        <StatCard label="Conversion rate" value={`${conv}%`} sub="Successful ÷ created" icon={BarChart3} iconBg="bg-violet-50" iconColor="text-violet-600" />
      </div>

      <SectionCard className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm"
              placeholder="Search training or source"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <select
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-slate-gray"
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
          >
            <option value="">All sources</option>
            <option value="link">Referral links</option>
            <option value="coupon">Coupon codes</option>
          </select>
          <select
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-slate-gray"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">All statuses</option>
            <option value="earned">Waiting</option>
            <option value="eligible">Earned</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-gray">
                <th className="px-4 py-3">Date & student</th>
                <th className="px-4 py-3">Training</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Net paid</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Commission status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageItems.map((r) => {
                const ini = partnerInitials(String(r.studentName))
                const source = r.couponCode ? String(r.couponCode) : String(r.linkSlug || r.source || 'Referral link')
                return (
                  <tr key={String(r.id)} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold">{ini}</div>
                        <div>
                          <p className="font-medium text-[#0f172a]">{String(r.studentName)}</p>
                          <p className="text-xs text-slate-gray">{String(r.studentEmail)}</p>
                          <p className="text-[10px] text-gray-400">{String(r.date)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{String(r.training || '—')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        {r.couponCode ? <Gift className="h-3.5 w-3.5 text-orange-500" /> : <Link2 className="h-3.5 w-3.5 text-blue-500" />}
                        {source}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{fmtInr(Number(r.amount || 0))}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">
                      {fmtInr(Number(r.commission || 0))}
                      {Number(r.commissionPercent || 0) > 0 ? (
                        <p className="text-[10px] font-normal text-slate-gray">
                          {Number(r.commissionPercent)}% of {fmtInr(Number(r.commissionBase ?? r.amount ?? 0))}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={commissionLabel(String(r.commissionStatus))} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!pageItems.length ? <p className="p-8 text-center text-sm text-slate-gray">No referrals yet. Share your link or coupon to get started.</p> : null}
        </div>
        {filtered.length > perPage ? (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-slate-gray">
            <span>
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">
                Previous
              </button>
              <span className="rounded border bg-brand-accent px-2 py-1 text-white">{page}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

// ── Payouts ─────────────────────────────────────────────────────────────────

export function PartnerPayouts() {
  const { stats: meStats } = usePartner()
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const token = useAuthStore((s) => s.token)
  const { partner } = usePartner()

  useEffect(() => {
    partnerService.payouts().then((r) => {
      setItems(r.items || [])
      setStats(r.stats || {})
    }).catch(() => undefined)
  }, [])

  const pending = stats.pendingPayout ?? num(meStats as Record<string, unknown>, 'pendingPayout')
  const hold = stats.holdAmount ?? num(meStats as Record<string, unknown>, 'holdAmount')
  const paid = stats.paidOut ?? num(meStats as Record<string, unknown>, 'paidOut')
  const minPayout = (stats.minPayout ?? num(meStats as Record<string, unknown>, 'minPayout')) || 500
  const bank = (partner?.bank || {}) as Record<string, string>
  const acctLast = (bank.accountNumber || '').slice(-4)
  const earnSeries = chartPoints(meStats as Record<string, unknown>, 'chartEarnings').slice(-6)

  const downloadReceipt = async (payoutId: string) => {
    try {
      const res = await fetch(partnerService.payoutReceiptUrl(payoutId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('download failed')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${payoutId}.pdf`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.alert('Could not download receipt')
    }
  }

  const nextPayoutDate = () => {
    const d = new Date()
    d.setMonth(d.getMonth() + (d.getDate() > 5 ? 1 : 0))
    d.setDate(5)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Payouts"
        subtitle="Track commission through the hold period, eligibility and completed payouts."
        action={
          <button
            type="button"
            onClick={() => void partnerService.exportPayoutStatement()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> Download statement
          </button>
        }
      />

      <SectionCard className="bg-gradient-to-r from-emerald-50 to-white border-emerald-100">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Available for next payout</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-4xl font-bold text-[#0f172a]">{fmtInr(pending)}</p>
            <p className="mt-1 text-sm text-slate-gray">Above the {fmtInr(minPayout)} minimum threshold.</p>
            {pending >= minPayout ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Scheduled for {nextPayoutDate()}
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-700">Balance rolls over until minimum is reached.</p>
            )}
            {acctLast ? (
              <p className="mt-2 text-xs text-slate-gray">
                Payout will use your approved {bank.bankName || 'bank'} account ending {acctLast}.
              </p>
            ) : null}
          </div>
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs text-slate-gray mb-1">
              <span>{fmtInr(pending)} eligible</span>
              <span>{fmtInr(minPayout)} minimum</span>
            </div>
            <div className="h-3 rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (pending / minPayout) * 100)}%` }} />
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="In 15-day hold" value={fmtInr(hold)} sub="Refund review period" icon={Clock} iconBg="bg-orange-50" iconColor="text-orange-600" />
        <StatCard label="Processing" value={fmtInr(0)} sub="No payout processing" icon={Wallet} iconBg="bg-violet-50" iconColor="text-violet-600" />
        <StatCard label="Total paid" value={fmtInr(paid)} sub={`${items.filter((p) => p.status === 'completed').length || items.length} completed payouts`} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard>
          <p className="text-sm font-semibold text-[#0f172a] mb-1">Monthly earnings</p>
          <p className="text-xs text-slate-gray mb-4">Successful commission earned recently</p>
          <BarChart points={earnSeries.length ? earnSeries : [{ date: '2025-01', value: 0 }]} height={140} />
        </SectionCard>
        <SectionCard>
          <p className="text-sm font-semibold text-[#0f172a] mb-1">Payout rules</p>
          <p className="text-xs text-slate-gray mb-4">Simple and transparent</p>
          <ul className="space-y-3">
            {[
              { icon: IndianRupee, title: `${fmtInr(minPayout)} minimum payout`, sub: 'Smaller balances roll over automatically.' },
              { icon: Calendar, title: 'Paid on the 5th', sub: 'Eligible commission is processed monthly.' },
              { icon: Clock, title: '15-day hold period', sub: 'Refunded payments cancel commission.' },
              { icon: Shield, title: 'Approved payout details', sub: 'Changes require admin verification.' },
            ].map(({ icon: Icon, title, sub }) => (
              <li key={title} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <Icon className="h-4 w-4 text-brand-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">{title}</p>
                  <p className="text-xs text-slate-gray">{sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard className="p-0 overflow-hidden">
        <p className="px-5 pt-5 text-sm font-semibold text-[#0f172a]">Payout history</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-gray-100 bg-gray-50/80 text-left text-[10px] font-semibold uppercase text-slate-gray">
                <th className="px-4 py-3">Payout ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((p) => (
                <tr key={String(p.payoutId)}>
                  <td className="px-4 py-3 font-mono text-xs">{String(p.payoutId)}</td>
                  <td className="px-4 py-3">{String(p.date)}</td>
                  <td className="px-4 py-3 font-semibold">{fmtInr(Number(p.amount || 0))}</td>
                  <td className="px-4 py-3 capitalize">{String(p.method || '—')}</td>
                  <td className="px-4 py-3"><StatusBadge status={String(p.status || 'completed')} /></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => void downloadReceipt(String(p.payoutId))} className="text-xs font-semibold text-brand-accent hover:underline">
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length ? <p className="p-8 text-center text-sm text-slate-gray">No payouts yet. Earnings become eligible after the hold period.</p> : null}
        </div>
      </SectionCard>
    </div>
  )
}

// ── Marketing ───────────────────────────────────────────────────────────────

const ASSET_ICONS: Record<string, typeof Image> = {
  poster: Image,
  brochure: FileText,
  video: Video,
  brand: Palette,
  guide: BookOpen,
}

export function PartnerMarketing() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState('all')

  useEffect(() => {
    partnerService.marketingKit().then((r) => {
      setItems(r.items || [])
      setUrl(r.mainReferralUrl || '')
    }).catch(() => undefined)
  }, [])

  const tabs = ['all', 'Posters', 'Brochures', 'Videos', 'Brand assets']
  const captions = items.filter((i) => i.type === 'caption')
  const assets = items.filter((i) => i.type !== 'caption' && i.type !== 'guide')
  const guide = items.find((i) => i.type === 'guide')

  const tabTypeMap: Record<string, string> = {
    Posters: 'poster',
    Brochures: 'brochure',
    Videos: 'video',
    'Brand assets': 'brand',
  }

  const filteredAssets = useMemo(() => {
    if (tab === 'all') return assets
    const t = tabTypeMap[tab]
    return assets.filter((i) => String(i.type || '').toLowerCase() === t)
  }, [tab, assets])

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Marketing Kit"
        subtitle="Download ready-made assets and copy-paste captions for WhatsApp, Instagram and email."
        action={
          guide?.url ? (
            <a href={String(guide.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-50">
              <BookOpen className="h-4 w-4" /> Promotion guide
            </a>
          ) : (
            <button type="button" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-50">
              <BookOpen className="h-4 w-4" /> Promotion guide
            </button>
          )
        }
      />

      {url ? (
        <SectionCard>
          <CopyField value={url.replace(/^https?:\/\//, '')} label="Your main referral link" />
        </SectionCard>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
              tab === t ? 'bg-[#0f172a] text-white' : 'border border-gray-200 bg-white text-slate-gray hover:bg-gray-50'
            }`}
          >
            {t === 'all' ? 'All assets' : t}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(filteredAssets.length ? filteredAssets : assets).map((it, idx) => {
          const colors = ['bg-blue-500', 'bg-orange-500', 'bg-violet-500', 'bg-emerald-500']
          const Icon = ASSET_ICONS[String(it.type)] || FileText
          return (
            <SectionCard key={String(it.id)} className="flex flex-col p-0 overflow-hidden">
              <div className={`relative flex h-32 items-center justify-center ${colors[idx % colors.length]}`}>
                <Icon className="h-10 w-10 text-white/90" />
                {it.url ? (
                  <a href={String(it.url)} target="_blank" rel="noreferrer" className="absolute right-2 top-2 rounded-lg bg-black/30 p-1.5 text-white hover:bg-black/50">
                    <Eye className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-semibold text-[#0f172a]">{String(it.title)}</p>
                <p className="mt-1 text-xs text-slate-gray line-clamp-2">{String(it.body || '').slice(0, 80)}</p>
                <div className="mt-auto flex gap-2 pt-4">
                  {it.url ? (
                    <>
                      <a href={String(it.url)} target="_blank" rel="noreferrer" className="flex-1 rounded-lg border py-2 text-center text-xs font-semibold hover:bg-gray-50">
                        Preview
                      </a>
                      <a href={String(it.url)} download className="flex-1 rounded-lg bg-brand-accent py-2 text-center text-xs font-semibold text-white hover:bg-primary-600">
                        Download
                      </a>
                    </>
                  ) : (
                    <button type="button" onClick={() => void navigator.clipboard.writeText(String(it.body || ''))} className="w-full rounded-lg border py-2 text-xs font-semibold hover:bg-gray-50">
                      Copy
                    </button>
                  )}
                </div>
              </div>
            </SectionCard>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {captions.map((it) => (
          <SectionCard key={String(it.id)}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-[#0f172a]">{String(it.title)}</p>
              {String(it.title).toLowerCase().includes('whatsapp') ? (
                <MessageCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <Mail className="h-5 w-5 text-orange-500 shrink-0" />
              )}
            </div>
            <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">{String(it.body)}</p>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(String(it.body || ''))}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50"
            >
              Copy {String(it.title).toLowerCase().includes('email') ? 'email' : 'caption'}
            </button>
          </SectionCard>
        ))}
      </div>
    </div>
  )
}

// ── Support ─────────────────────────────────────────────────────────────────

const FAQ = [
  { q: 'When does my commission become eligible?', a: 'Commission enters a 15-day hold after a successful payment. After the hold, it becomes eligible for the next monthly payout on the 5th.' },
  { q: 'How is coupon commission calculated?', a: 'Your coupon commission is calculated on the net amount paid by the student after the coupon discount is applied. The commission percentage is set when your partner account is approved.' },
  { q: 'When will I receive my payout?', a: 'Eligible commission above the ₹500 minimum is processed on the 5th of each month to your approved bank or UPI details.' },
  { q: 'Can I create a link or coupon myself?', a: 'Partners request new links and coupons through Support. Our team creates and assigns them so tracking and commission rules stay accurate.' },
  { q: 'How do I request a new referral link?', a: 'Go to Support, choose Link Request, and describe the campaign. Our team will create and assign the link within 1–2 business days.' },
  { q: 'Can I change my bank details?', a: 'Yes — update payout details in Profile and submit for approval. Payouts use approved details only.' },
]

export function PartnerSupport() {
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('Link Request')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState('')
  const [faqOpen, setFaqOpen] = useState(0)
  const [faqSearch, setFaqSearch] = useState('')

  const filteredFaq = FAQ.filter((f) => !faqSearch || f.q.toLowerCase().includes(faqSearch.toLowerCase()))

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Partner help centre"
        title="Support"
        subtitle="Raise requests for links, coupons, payouts, bank details or technical issues."
        action={
          <div className="flex flex-wrap gap-2 text-xs">
            <a href="mailto:partners@xpertintern.com" className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 font-medium hover:bg-gray-50">
              <Mail className="h-3.5 w-3.5" /> partners@xpertintern.com
            </a>
            <a href="https://wa.me/919999999999" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 font-medium hover:bg-gray-50">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp support
            </a>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard>
          <p className="text-sm font-semibold text-[#0f172a] mb-4">Raise a support ticket</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-gray">Subject</label>
              <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="Briefly describe your request" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-gray">Category</label>
              <select className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                {['Link Request', 'Coupon Request', 'Payout Issue', 'Bank Details', 'Technical Issue', 'Other'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-gray">Description</label>
              <textarea className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" rows={5} placeholder="Share all details so our partner team can help quickly…" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent py-3 text-sm font-semibold text-white hover:bg-primary-600"
              onClick={async () => {
                const fullSubject = `[${category}] ${subject}`
                const r = await partnerService.supportTicket(fullSubject, message)
                setDone(r.message || 'Submitted')
                setSubject('')
                setMessage('')
              }}
            >
              <Send className="h-4 w-4" /> Submit ticket
            </button>
            {done ? <p className="text-sm text-emerald-700">{done}</p> : null}
          </div>
        </SectionCard>

        <SectionCard>
          <p className="text-sm font-semibold text-[#0f172a] mb-4">My tickets</p>
          <p className="text-sm text-slate-gray">Tickets you submit appear in our support queue. You will receive email updates on progress.</p>
          <p className="mt-4 rounded-xl bg-gray-50 p-4 text-xs text-slate-gray">No tickets loaded in portal yet — check your email for ticket confirmations after submitting.</p>
        </SectionCard>
      </div>

      <SectionCard>
        <p className="text-sm font-semibold text-[#0f172a] mb-3">Frequently asked questions</p>
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm" placeholder="Search help articles" value={faqSearch} onChange={(e) => setFaqSearch(e.target.value)} />
        </div>
        <div className="divide-y divide-gray-100">
          {filteredFaq.map((f, i) => (
            <div key={f.q}>
              <button type="button" className="flex w-full items-center justify-between py-3 text-left text-sm font-medium text-[#0f172a]" onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}>
                {f.q}
                <ChevronDown className={`h-4 w-4 shrink-0 transition ${faqOpen === i ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen === i ? <p className="pb-3 text-sm text-slate-gray">{f.a}</p> : null}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

// ── Profile ─────────────────────────────────────────────────────────────────

export function PartnerProfile() {
  const { partner, refresh } = usePartner()
  const [form, setForm] = useState({ fullName: '', city: '', state: '', organisationName: '', phone: '', pan: '', upiId: '', accountHolder: '', accountNumber: '', ifsc: '', bankName: '' })
  const [pw, setPw] = useState({ current: '', next: '' })
  const [msg, setMsg] = useState('')
  const [prefs, setPrefs] = useState({ referrals: true, weekly: true, payout: true, marketing: false })

  useEffect(() => {
    if (!partner) return
    const bank = (partner.bank || {}) as Record<string, string>
    setForm({
      fullName: String(partner.fullName || ''),
      city: String(partner.city || ''),
      state: String(partner.state || ''),
      organisationName: String(partner.organisationName || ''),
      phone: String(partner.phone || ''),
      pan: String(partner.pan || ''),
      upiId: String(partner.upiId || ''),
      accountHolder: bank.accountHolder || '',
      accountNumber: bank.accountNumber || '',
      ifsc: bank.ifsc || '',
      bankName: bank.bankName || '',
    })
  }, [partner])

  const save = async () => {
    await partnerService.updateProfile(form)
    setMsg('Saved. Bank/UPI changes need admin approval before payouts use them.')
    await refresh()
  }

  const initials = partnerInitials(String(partner?.fullName || ''))
  const commission = Number(partner?.commissionPercent || 0)

  const profileCompletion = useMemo(() => {
    let score = 0
    if (form.fullName.trim()) score += 15
    if (form.phone.trim()) score += 15
    if (form.city.trim() && form.state.trim()) score += 15
    if (form.pan.trim()) score += 15
    if (form.upiId.trim() || (form.accountNumber.trim() && form.ifsc.trim())) score += 25
    if (!partner?.bankPendingApproval && (partner?.bankApproved || form.accountNumber)) score += 15
    return Math.min(100, score)
  }, [form, partner])

  return (
    <div className="space-y-6 pb-8">
      <PageHeader eyebrow="Account & support settings" title="Profile" subtitle="Manage your contact details, approved payout account, security and notifications." />

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-accent text-lg font-bold text-white">{initials}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-[#0f172a]">{String(partner?.fullName || '')}</h2>
                <StatusBadge status={String(partner?.status || 'active')} />
              </div>
              <p className="text-sm text-slate-gray">{String(partner?.partnerType || 'Partner')} · Partner ID: {String(partner?.partnerCode || '')}</p>
              <p className="text-xs text-slate-gray">Joined {String(partner?.createdAt || '').slice(0, 10)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-4 text-center">
              <p className="text-3xl font-bold text-brand-accent">{commission}%</p>
              <p className="text-xs text-slate-gray">Commission rate</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-center">
              <div className="relative mx-auto h-16 w-16">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray={`${profileCompletion} 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#0f172a]">{profileCompletion}%</span>
              </div>
              <p className="mt-1 text-xs text-slate-gray">Profile complete</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard>
            <p className="text-sm font-semibold text-[#0f172a]">Basic information</p>
            <p className="text-xs text-slate-gray mb-4">Contact details visible to the XpertIntern partner team.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['fullName', 'Full name'],
                ['phone', 'Phone number'],
                ['organisationName', 'Organization (optional)'],
                ['city', 'City'],
                ['state', 'State'],
                ['pan', 'PAN number'],
              ].map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-slate-gray">{label}</label>
                  <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" value={(form as Record<string, string>)[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-gray">Partner type</label>
                <input className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" value={String(partner?.partnerType || '')} readOnly />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-gray">Email address</label>
                <input className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" value={String(partner?.email || '')} readOnly />
              </div>
            </div>
            <button type="button" onClick={() => void save()} className="mt-4 rounded-xl bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
              Save changes
            </button>
            {msg ? <p className="mt-2 text-sm text-emerald-700">{msg}</p> : null}
          </SectionCard>

          <SectionCard>
            <p className="text-sm font-semibold text-[#0f172a]">Payout details</p>
            <p className="text-xs text-slate-gray mb-4">Bank or UPI details used for monthly commission payouts.</p>
            {partner?.bankPendingApproval ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <span>Your payout details were updated. Waiting for admin approval…</span>
                <StatusBadge status="Pending Approval" />
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['accountHolder', 'Account holder name'],
                ['bankName', 'Bank name'],
                ['accountNumber', 'Account number'],
                ['ifsc', 'IFSC code'],
                ['upiId', 'UPI ID'],
              ].map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-slate-gray">{label}</label>
                  <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" value={(form as Record<string, string>)[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => void save()} className="mt-4 rounded-xl bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
              Submit for approval
            </button>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard>
            <p className="text-sm font-semibold text-[#0f172a] mb-4">Security</p>
            <div className="space-y-3">
              <details className="rounded-xl border border-gray-100 p-3">
                <summary className="cursor-pointer text-sm font-medium">Change password</summary>
                <div className="mt-3 space-y-2">
                  <input type="password" className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Current password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
                  <input type="password" className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="New password (min 8)" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                    onClick={async () => {
                      try {
                        await partnerService.changePassword(pw.current, pw.next)
                        setMsg('Password updated')
                        setPw({ current: '', next: '' })
                      } catch {
                        setMsg('Could not update password')
                      }
                    }}
                  >
                    Update password
                  </button>
                </div>
              </details>
            </div>
            <button type="button" className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100">
              Sign out from all devices
            </button>
          </SectionCard>

          <SectionCard>
            <p className="text-sm font-semibold text-[#0f172a] mb-4">Email preferences</p>
            {[
              ['referrals', 'New successful referrals'],
              ['weekly', 'Weekly performance summary'],
              ['payout', 'Payout received'],
              ['marketing', 'Marketing kit updates'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between py-2 text-sm">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={prefs[key as keyof typeof prefs]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-brand-accent"
                />
              </label>
            ))}
          </SectionCard>

          <div className="rounded-2xl bg-gradient-to-br from-brand-accent to-primary-600 p-5 text-white">
            <Shield className="h-8 w-8 opacity-90" />
            <p className="mt-3 text-sm font-semibold">Your data is protected</p>
            <p className="mt-1 text-xs text-blue-100">Private and payout information is visible only to authorized XpertIntern team members.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
