import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Download,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Banknote,
} from 'lucide-react'
import { adminPartnerService } from '@/services/partnerService'
import { useAuthStore } from '@/store/authStore'
import { AddPartnerModal } from '@/components/admin/AddPartnerModal'
import {
  AdminPartnerPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  AdminTableShell,
  AdminFilterBar,
  AdminInfoBanner,
  PartnerAvatar,
  fmtInr,
  fmtPartnerJoined,
  PARTNER_STAT_ICONS,
  payoutMethodLabel,
} from '@/components/admin/AdminPartnerUI'
import { PartnerListRowActions } from '@/components/admin/PartnerListRowActions'

export { AdminPartnerDetail } from '@/components/admin/AdminPartnerDetailView'
export { AdminPartnerApplicationDetail } from '@/components/admin/AdminPartnerApplicationDetailView'

export function AdminPartnerApplications() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [status, setStatus] = useState('')
  const [ptype, setPtype] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const perPage = 8

  const load = () => {
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (ptype) params.partnerType = ptype
    if (search.trim()) params.search = search.trim()
    if (from) params.from = from
    if (to) params.to = to
    adminPartnerService.listApplications(params).then((r) => setItems(r.items || [])).catch(() => setItems([]))
  }

  useEffect(() => {
    load()
  }, [status, ptype])

  const summary = useMemo(() => {
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    return {
      submitted: items.filter((a) => a.status === 'submitted').length,
      underReview: items.filter((a) => a.status === 'under_review').length,
      needsInfo: items.filter((a) => a.status === 'needs_more_info').length,
      approvedMonth: items.filter((a) => {
        if (a.status !== 'approved') return false
        const d = new Date(String(a.createdAt || ''))
        return d.getMonth() === month && d.getFullYear() === year
      }).length,
    }
  }, [items])

  const pageItems = items.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.max(1, Math.ceil(items.length / perPage))

  const exportCsv = async () => {
    const params: Record<string, string> = {}
    if (status) params.status = status
    const url = adminPartnerService.applicationsExportUrl(params)
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'partner-applications.csv'
    a.click()
  }

  return (
    <div className="space-y-6 pb-8">
      <AdminPartnerPageHeader
        title="Partner applications"
        subtitle="Review new applications and move suitable candidates into your partner network."
        action={
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [`${summary.submitted} Submitted`, ''],
          [`${summary.underReview} Under review`, ''],
          [`${summary.needsInfo} Needs info`, ''],
          [`${summary.approvedMonth} Approved this month`, ''],
        ].map(([label]) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] shadow-sm">
            {label}
          </div>
        ))}
      </div>

      <AdminFilterBar>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm"
            placeholder="Search applicant or application ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <select className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          {['submitted', 'under_review', 'needs_more_info', 'approved', 'rejected'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={ptype} onChange={(e) => { setPtype(e.target.value); setPage(1) }}>
          <option value="">All partner types</option>
          {['College', 'Coaching Institute', 'Influencer', 'YouTuber', 'Student Community', 'Individual', 'Other'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input type="date" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
        <input type="date" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
        <button type="button" onClick={load} className="rounded-xl bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
        {selected.length ? (
          <button
            type="button"
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={async () => {
              await adminPartnerService.bulkReject(selected, 'Bulk reject')
              setSelected([])
              load()
            }}
          >
            Reject ({selected.length})
          </button>
        ) : null}
      </AdminFilterBar>

      <AdminTableShell footer={items.length ? `Showing ${(page - 1) * perPage + 1}–${Math.min(page * perPage, items.length)} of ${items.length} applications` : undefined}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-gray">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageItems.map((a) => (
                <tr key={String(a.id)} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(String(a.id))}
                      onChange={(e) => {
                        const id = String(a.id)
                        setSelected((s) => (e.target.checked ? [...s, id] : s.filter((x) => x !== id)))
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-[#0f172a]">{String(a.applicationId)}</td>
                  <td className="px-4 py-3 font-medium">{String(a.fullName)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{String(a.partnerType || '—')}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-gray">{String(a.city || '—')}, {String(a.state || '—')}</td>
                  <td className="px-4 py-3 text-slate-gray">{String(a.audienceSize || '—')}</td>
                  <td className="px-4 py-3 text-xs text-slate-gray whitespace-nowrap">{String(a.createdAt)}</td>
                  <td className="px-4 py-3"><AdminStatusBadge status={String(a.status)} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-accent hover:underline"
                      onClick={() => navigate(`/admin/partners/applications/${a.id}`)}
                    >
                      Review <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pageItems.length ? <p className="p-8 text-center text-sm text-slate-gray">No applications found.</p> : null}
        </div>
        {totalPages > 1 ? (
          <div className="flex justify-end gap-1 border-t border-gray-100 px-4 py-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Previous</button>
            <span className="rounded border bg-brand-accent px-2 py-1 text-xs text-white">{page}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Next</button>
          </div>
        ) : null}
      </AdminTableShell>
    </div>
  )
}

export function AdminPartnersList() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [eligible, setEligible] = useState<Array<Record<string, unknown>>>([])
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('')
  const [typeF, setTypeF] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [pendingApps, setPendingApps] = useState(0)
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const perPage = 5

  const load = () => {
    const params: Record<string, string> = {}
    if (search.trim()) params.search = search.trim()
    if (statusF) params.status = statusF
    adminPartnerService.listPartners(params).then((r) => setItems(r.items || [])).catch(() => setItems([]))
    adminPartnerService.eligiblePayouts().then((r) => setEligible(r.items || [])).catch(() => setEligible([]))
    adminPartnerService.pendingMeta().then((m) => setPendingApps(m.pendingApplications || 0)).catch(() => undefined)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!typeF) return items
    return items.filter((p) => String(p.partnerType || '').toLowerCase() === typeF.toLowerCase())
  }, [items, typeF])

  const stats = useMemo(() => {
    const active = items.filter((p) => p.status === 'active').length
    const earnings = items.reduce((a, p) => a + Number(p.totalEarnings || 0), 0)
    const pending = eligible.reduce((a, p) => a + Number(p.amount || 0), 0)
    return { total: items.length, active, earnings, pending, eligibleCount: eligible.length }
  }, [items, eligible])

  const pageItems = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const types = [...new Set(items.map((p) => String(p.partnerType || '')).filter(Boolean))]

  return (
    <div className="space-y-6 pb-8">
      <AdminPartnerPageHeader
        title="All partners"
        subtitle="Manage partner accounts, performance, commission and access from one place."
        action={
          <>
            <Link
              to="/admin/partners/applications"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
            >
              Applications
              {pendingApps > 0 ? (
                <span className="rounded-full bg-brand-accent px-2 py-0.5 text-[10px] font-bold text-white">{pendingApps}</span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" /> Add partner
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Total partners" value={stats.total} sub="In your network" icon={PARTNER_STAT_ICONS.total.icon} iconBg={PARTNER_STAT_ICONS.total.bg} iconColor={PARTNER_STAT_ICONS.total.color} />
        <AdminStatCard label="Active partners" value={stats.active} sub={stats.total ? `${Math.round((stats.active / stats.total) * 1000) / 10}% active` : '—'} icon={PARTNER_STAT_ICONS.active.icon} iconBg={PARTNER_STAT_ICONS.active.bg} iconColor={PARTNER_STAT_ICONS.active.color} />
        <AdminStatCard label="Partner earnings" value={fmtInr(stats.earnings, true)} sub="All-time commission" icon={PARTNER_STAT_ICONS.earnings.icon} iconBg={PARTNER_STAT_ICONS.earnings.bg} iconColor={PARTNER_STAT_ICONS.earnings.color} />
        <AdminStatCard label="Pending payouts" value={fmtInr(stats.pending)} sub={`${stats.eligibleCount} partners eligible`} icon={PARTNER_STAT_ICONS.pending.icon} iconBg={PARTNER_STAT_ICONS.pending.bg} iconColor={PARTNER_STAT_ICONS.pending.color} />
      </div>

      <AdminFilterBar>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm"
            placeholder="Search name, code, email or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <select className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="">Status: All</option>
          {['active', 'suspended', 'inactive'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1) }}>
          <option value="">Partner type</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="button" onClick={load} className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50" aria-label="Refresh">
          <RefreshCw className="h-4 w-4 text-slate-gray" />
        </button>
        <button
          type="button"
          onClick={() => void adminPartnerService.exportPartners(statusF ? { status: statusF } : undefined)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </AdminFilterBar>

      <AdminTableShell>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-gray">
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Referrals</th>
                <th className="px-4 py-3">Earnings</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageItems.map((p) => (
                <tr key={String(p.id)} className="hover:bg-gray-50/50 align-middle">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <PartnerAvatar name={String(p.fullName)} />
                      <div>
                        <p className="font-semibold text-[#0f172a]">{String(p.fullName)}</p>
                        <p className="font-mono text-[11px] text-slate-gray">{String(p.partnerCode)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-medium text-[#0f172a]">{String(p.partnerType || '—')}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-gray">
                    <p className="text-[#0f172a]">{String(p.email)}</p>
                    <p className="text-xs mt-0.5">{String(p.phone || '—')}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-[#0f172a]">{Number(p.totalSuccessful || 0)}</p>
                    <p className="text-xs text-slate-gray">successful</p>
                  </td>
                  <td className="px-4 py-4 font-semibold text-[#0f172a] whitespace-nowrap">{fmtInr(Number(p.totalEarnings || 0))}</td>
                  <td className="px-4 py-4"><AdminStatusBadge status={String(p.status || 'active')} /></td>
                  <td className="px-4 py-4 text-sm text-slate-gray whitespace-nowrap">{fmtPartnerJoined(String(p.createdAt || ''))}</td>
                  <td className="px-4 py-4">
                    <PartnerListRowActions
                      partnerId={String(p.id)}
                      partnerName={String(p.fullName)}
                      status={String(p.status || 'active')}
                      onChanged={load}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pageItems.length ? <p className="p-8 text-center text-sm text-slate-gray">No partners found.</p> : null}
        </div>
        {filtered.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-slate-gray">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length} partners
            </p>
            <div className="flex items-center gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-gray-50">Previous</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => setPage(n)} className={`min-w-[2rem] rounded-lg border px-2 py-1.5 text-xs font-semibold ${page === n ? 'border-brand-accent bg-brand-accent text-white' : 'border-gray-200 hover:bg-gray-50'}`}>{n}</button>
              ))}
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        ) : null}
      </AdminTableShell>

      <AddPartnerModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(pid) => {
          setShowCreate(false)
          if (pid) navigate(`/admin/partners/${pid}`)
          else load()
        }}
      />
    </div>
  )
}

export function AdminPartnerPayouts() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [utr, setUtr] = useState('')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => adminPartnerService.eligiblePayouts().then((r) => {
    setItems(r.items || [])
    setSummary(r.summary || {})
  }).catch(() => setItems([]))
  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((p) =>
      [p.fullName, p.partnerCode, p.email].some((v) => String(v || '').toLowerCase().includes(q)),
    )
  }, [items, search])

  const stats = useMemo(() => {
    const pending = items.reduce((a, p) => a + Number(p.amount || 0), 0)
    return { pending, count: items.length }
  }, [items])

  const selectedTotal = filtered
    .filter((p) => selected.includes(String(p.partnerId)))
    .reduce((a, p) => a + Number(p.amount || 0), 0)

  return (
    <div className="space-y-6 pb-8">
      <AdminPartnerPageHeader
        title="Partner payouts"
        subtitle="Review eligible commissions and process single or bulk partner payouts."
        action={
          <>
            <button
              type="button"
              onClick={() => void adminPartnerService.exportPayouts()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Export report
            </button>
            <button
              type="button"
              disabled={!selected.length || !utr.trim() || busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const r = await adminPartnerService.processPayouts(selected, utr.trim())
                  setMsg(`Processed ${(r as { processed?: number }).processed || 0} payout(s)`)
                  setSelected([])
                  setUtr('')
                  load()
                } finally {
                  setBusy(false)
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-50"
            >
              <Banknote className="h-4 w-4" /> Process payout
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Pending payout" value={fmtInr(stats.pending)} sub={`${stats.count} eligible partners`} icon={PARTNER_STAT_ICONS.pending.icon} iconBg={PARTNER_STAT_ICONS.pending.bg} iconColor={PARTNER_STAT_ICONS.pending.color} />
        <AdminStatCard label="Paid this month" value={fmtInr(summary.paidThisMonth || 0)} sub="From payout history" icon={PARTNER_STAT_ICONS.paid.icon} iconBg={PARTNER_STAT_ICONS.paid.bg} iconColor={PARTNER_STAT_ICONS.paid.color} />
        <AdminStatCard label="In hold period" value={fmtInr(summary.holdAmountTotal || 0)} sub="Releases after 15 days" icon={PARTNER_STAT_ICONS.hold.icon} iconBg={PARTNER_STAT_ICONS.hold.bg} iconColor={PARTNER_STAT_ICONS.hold.color} />
      </div>

      <AdminInfoBanner>
        <p className="font-semibold">Payout eligibility</p>
        <p className="mt-0.5 text-blue-800/90">Partners appear here after the 15-day hold period and when their balance reaches ₹500.</p>
      </AdminInfoBanner>

      <AdminFilterBar>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm" placeholder="Search partner or code" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-gray">Eligible only</span>
        <button type="button" onClick={load} className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50" aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </AdminFilterBar>

      <AdminTableShell>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-gray">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Eligible amount</th>
                <th className="px-4 py-3">Payout method</th>
                <th className="px-4 py-3">Hold cleared</th>
                <th className="px-4 py-3">Last paid</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={String(p.partnerId)} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(String(p.partnerId))}
                      onChange={(e) => {
                        const id = String(p.partnerId)
                        setSelected((s) => (e.target.checked ? [...s, id] : s.filter((x) => x !== id)))
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PartnerAvatar name={String(p.fullName)} />
                      <div>
                        <p className="font-semibold text-[#0f172a]">{String(p.fullName)}</p>
                        <p className="font-mono text-[11px] text-slate-gray">{String(p.partnerCode)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#0f172a]">{fmtInr(Number(p.amount || 0))}</td>
                  <td className="px-4 py-3 text-xs text-slate-gray">{payoutMethodLabel(p)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Eligible
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-gray">—</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand-accent hover:underline"
                      onClick={() => {
                        setSelected([String(p.partnerId)])
                        document.getElementById('payout-utr')?.focus()
                      }}
                    >
                      Process <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? <p className="p-8 text-center text-sm text-slate-gray">No eligible payouts right now.</p> : null}
        </div>
      </AdminTableShell>

      <div className="sticky bottom-0 rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="payout-utr"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
            placeholder="Enter UTR / transaction reference"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
          />
          <p className="text-sm text-slate-gray shrink-0">
            Selected: <strong>{selected.length}</strong> partner{selected.length !== 1 ? 's' : ''}
            {selected.length ? ` · ${fmtInr(selectedTotal)}` : ''}
          </p>
          <button
            type="button"
            disabled={!selected.length || !utr.trim() || busy}
            onClick={async () => {
              setBusy(true)
              try {
                const r = await adminPartnerService.processPayouts(selected, utr.trim())
                setMsg(`Processed ${(r as { processed?: number }).processed || 0} payout(s)`)
                setSelected([])
                setUtr('')
                load()
              } finally {
                setBusy(false)
              }
            }}
            className="rounded-xl bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 shrink-0"
          >
            Process selected payout
          </button>
        </div>
        {msg ? <p className="mt-2 text-sm text-emerald-700">{msg}</p> : null}
      </div>
    </div>
  )
}
