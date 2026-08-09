import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminPartnerService } from '@/services/partnerService'

export function AdminPartnerApplications() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const load = () => {
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (search.trim()) params.search = search.trim()
    adminPartnerService.listApplications(params).then((r) => setItems(r.items || [])).catch(() => setItems([]))
  }

  useEffect(() => {
    load()
  }, [status])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-brand-navy">Partner applications</h1>
        <Link to="/admin/partners" className="text-sm text-brand-accent">
          All partners →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="rounded border px-2 py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['submitted', 'under_review', 'needs_more_info', 'approved', 'rejected'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input className="rounded border px-2 py-1.5 text-sm" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="button" onClick={load} className="rounded bg-brand-accent px-3 py-1.5 text-sm text-white">
          Search
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">App ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">City/State</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((a) => (
              <tr key={String(a.id)}>
                <td className="px-3 py-2 font-mono text-xs">{String(a.applicationId)}</td>
                <td className="px-3 py-2">{String(a.fullName)}</td>
                <td className="px-3 py-2">{String(a.partnerType)}</td>
                <td className="px-3 py-2">
                  {String(a.city)} / {String(a.state)}
                </td>
                <td className="px-3 py-2 text-xs">{String(a.createdAt)}</td>
                <td className="px-3 py-2 capitalize text-xs">{String(a.status).replace(/_/g, ' ')}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="text-brand-accent text-xs font-medium" onClick={() => navigate(`/admin/partners/applications/${a.id}`)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminPartnerApplicationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [app, setApp] = useState<Record<string, unknown> | null>(null)
  const [commission, setCommission] = useState('10')
  const [question, setQuestion] = useState('')
  const [rejectReason, setRejectReason] = useState('Other')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!id) return
    adminPartnerService.getApplication(id).then((r) => setApp(r.application)).catch(() => setApp(null))
  }, [id])

  if (!app) return <p className="text-sm text-slate-gray">Loading…</p>

  return (
    <div className="space-y-4 max-w-3xl">
      <button type="button" onClick={() => navigate(-1)} className="text-sm text-brand-accent">
        ← Back
      </button>
      <h1 className="text-xl font-semibold text-brand-navy">{String(app.applicationId)}</h1>
      <p className="text-sm capitalize">Status: {String(app.status).replace(/_/g, ' ')}</p>
      <dl className="grid gap-2 sm:grid-cols-2 text-sm">
        {['fullName', 'email', 'phone', 'city', 'state', 'partnerType', 'organisationName', 'audienceSize', 'promotePlan'].map((k) => (
          <div key={k} className={k === 'promotePlan' ? 'sm:col-span-2' : ''}>
            <dt className="text-xs text-slate-gray">{k}</dt>
            <dd>{String(app[k] || '—')}</dd>
          </div>
        ))}
      </dl>
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <div className="flex items-center gap-2">
          <input className="w-20 rounded border px-2 py-1 text-sm" value={commission} onChange={(e) => setCommission(e.target.value)} />
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={async () => {
              const r = await adminPartnerService.approve(String(app.id), { commissionPercent: Number(commission) })
              const pid = (r as { partner?: { id?: string } }).partner?.id
              setNotice('Approved')
              if (pid) navigate(`/admin/partners/${pid}`)
            }}
          >
            Approve
          </button>
        </div>
        <button
          type="button"
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            await adminPartnerService.reject(String(app.id), { reason: rejectReason, shareReason: true })
            setNotice('Rejected')
          }}
        >
          Reject
        </button>
        <select className="rounded border text-sm" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
          {['Incomplete information', 'Not aligned with our audience', 'Duplicate', 'Suspicious', 'Other'].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="border-t pt-4 space-y-2">
        <textarea className="w-full rounded border px-3 py-2 text-sm" rows={3} placeholder="Request more info…" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            await adminPartnerService.requestInfo(String(app.id), question)
            setNotice('Info requested')
          }}
        >
          Request more info
        </button>
      </div>
    </div>
  )
}

export function AdminPartnersList() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', partnerType: 'Individual', commissionPercent: '10' })
  const navigate = useNavigate()

  const load = () => {
    adminPartnerService.listPartners(search ? { search } : undefined).then((r) => setItems(r.items || [])).catch(() => setItems([]))
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-brand-navy">All partners</h1>
        <div className="flex gap-2">
          <Link to="/admin/partners/applications" className="text-sm text-brand-accent">
            Applications
          </Link>
          <Link to="/admin/partners/payouts" className="text-sm text-brand-accent">
            Payouts
          </Link>
          <button type="button" onClick={() => setShowCreate(true)} className="rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-semibold text-white">
            + Add Partner
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <input className="rounded border px-2 py-1.5 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, name, email…" />
        <button type="button" onClick={load} className="rounded border px-3 text-sm">
          Search
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Earnings</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((p) => (
              <tr key={String(p.id)}>
                <td className="px-3 py-2 font-mono text-xs">{String(p.partnerCode)}</td>
                <td className="px-3 py-2">{String(p.fullName)}</td>
                <td className="px-3 py-2">{String(p.partnerType)}</td>
                <td className="px-3 py-2">{String(p.email)}</td>
                <td className="px-3 py-2">₹{Number(p.totalEarnings || 0).toLocaleString()}</td>
                <td className="px-3 py-2 capitalize">{String(p.status)}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="text-brand-accent text-xs" onClick={() => navigate(`/admin/partners/${p.id}`)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 space-y-3">
            <h3 className="font-semibold">Add partner</h3>
            {Object.entries(form).map(([k, v]) => (
              <input key={k} className="w-full rounded border px-3 py-2 text-sm" placeholder={k} value={v} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
            ))}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded border px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-brand-accent px-3 py-1.5 text-sm text-white"
                onClick={async () => {
                  const r = await adminPartnerService.createPartner({ ...form, commissionPercent: Number(form.commissionPercent) })
                  const pid = (r as { partner?: { id?: string } }).partner?.id
                  setShowCreate(false)
                  if (pid) navigate(`/admin/partners/${pid}`)
                  else load()
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function AdminPartnerDetail() {
  const { id } = useParams()
  const [tab, setTab] = useState<'profile' | 'links' | 'coupons' | 'performance'>('profile')
  const [data, setData] = useState<Awaited<ReturnType<typeof adminPartnerService.getPartner>> | null>(null)
  const [linkForm, setLinkForm] = useState({ label: '', linkType: 'site_wide', trainingId: '', customSlug: '' })
  const [couponForm, setCouponForm] = useState({ code: '', discountType: 'percent', discountValue: '10' })
  const [trainings, setTrainings] = useState<Array<{ id: string; title: string }>>([])

  const reload = () => {
    if (!id) return
    adminPartnerService.getPartner(id).then(setData).catch(() => setData(null))
  }
  useEffect(() => {
    reload()
    adminPartnerService.pendingMeta().then((m) => setTrainings(m.trainings || [])).catch(() => undefined)
  }, [id])

  if (!data) return <p className="text-sm">Loading…</p>
  const p = data.partner

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-brand-navy">
        {String(p.fullName)} · {String(p.partnerCode)}
      </h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {(['profile', 'links', 'coupons', 'performance'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-1 capitalize ${tab === t ? 'bg-brand-navy text-white' : 'bg-gray-100'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'profile' ? (
        <div className="rounded-xl border bg-white p-4 text-sm space-y-1">
          <p>Email: {String(p.email)}</p>
          <p>Phone: {String(p.phone)}</p>
          <p>Type: {String(p.partnerType)}</p>
          <p>Commission: {String(p.commissionPercent)}%</p>
          <p>Status: {String(p.status)}</p>
          <p>City/State: {String(p.city)} / {String(p.state)}</p>
        </div>
      ) : null}
      {tab === 'performance' ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(data.stats || {}).map(([k, v]) => (
            <div key={k} className="rounded-xl border bg-white p-3">
              <p className="text-xs text-slate-gray">{k}</p>
              <p className="font-bold">
                {typeof v === 'number' && (k.toLowerCase().includes('earn') || k.toLowerCase().includes('payout') || k.toLowerCase().includes('paid'))
                  ? `₹${v}`
                  : String(v)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {tab === 'links' ? (
        <div className="space-y-3">
          <div className="rounded-xl border bg-white p-4 space-y-2">
            <p className="font-medium text-sm">Create referral link</p>
            <input className="w-full rounded border px-2 py-1.5 text-sm" placeholder="Label" value={linkForm.label} onChange={(e) => setLinkForm((f) => ({ ...f, label: e.target.value }))} />
            <select className="w-full rounded border px-2 py-1.5 text-sm" value={linkForm.linkType} onChange={(e) => setLinkForm((f) => ({ ...f, linkType: e.target.value }))}>
              <option value="site_wide">Site-wide</option>
              <option value="training">Training-specific</option>
            </select>
            {linkForm.linkType === 'training' ? (
              <select className="w-full rounded border px-2 py-1.5 text-sm" value={linkForm.trainingId} onChange={(e) => setLinkForm((f) => ({ ...f, trainingId: e.target.value }))}>
                <option value="">Select training</option>
                {trainings.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className="rounded bg-brand-accent px-3 py-1.5 text-sm text-white"
              onClick={async () => {
                await adminPartnerService.createLink(String(id), linkForm)
                reload()
              }}
            >
              Create link
            </button>
          </div>
          {(data.links || []).map((l) => (
            <div key={String(l.id)} className="rounded border bg-white p-3 text-xs">
              <p className="font-semibold">{String(l.label)}</p>
              <p className="font-mono break-all">{String(l.url)}</p>
              <p>
                Clicks {String(l.clicks)} · Success {String(l.paymentsSuccess)} · ₹{Number(l.earnings || 0)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {tab === 'coupons' ? (
        <div className="space-y-3">
          <div className="rounded-xl border bg-white p-4 space-y-2">
            <p className="font-medium text-sm">Create coupon</p>
            <input className="w-full rounded border px-2 py-1.5 text-sm" placeholder="Code" value={couponForm.code} onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value }))} />
            <select className="w-full rounded border px-2 py-1.5 text-sm" value={couponForm.discountType} onChange={(e) => setCouponForm((f) => ({ ...f, discountType: e.target.value }))}>
              <option value="percent">Percentage</option>
              <option value="flat">Flat ₹</option>
            </select>
            <input className="w-full rounded border px-2 py-1.5 text-sm" placeholder="Value" value={couponForm.discountValue} onChange={(e) => setCouponForm((f) => ({ ...f, discountValue: e.target.value }))} />
            <button
              type="button"
              className="rounded bg-brand-accent px-3 py-1.5 text-sm text-white"
              onClick={async () => {
                await adminPartnerService.createCoupon(String(id), { ...couponForm, discountValue: Number(couponForm.discountValue) })
                reload()
              }}
            >
              Create coupon
            </button>
          </div>
          {(data.coupons || []).map((c) => (
            <div key={String(c.id)} className="rounded border bg-white p-3 text-xs">
              <p className="font-bold">{String(c.code)}</p>
              <p>
                {String(c.discountType)} {String(c.discountValue)} · Success {String(c.successCount)} · ₹{Number(c.earnings || 0)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function AdminPartnerPayouts() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [selected, setSelected] = useState<string[]>([])
  const [utr, setUtr] = useState('')
  const [msg, setMsg] = useState('')

  const load = () => adminPartnerService.eligiblePayouts().then((r) => setItems(r.items || [])).catch(() => setItems([]))
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-brand-navy">Partner payouts</h1>
      <p className="text-sm text-slate-gray">Partners with eligible commission ≥ ₹500 after 15-day hold.</p>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Partner</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">UPI / Bank</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((p) => (
              <tr key={String(p.partnerId)}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(String(p.partnerId))}
                    onChange={(e) => {
                      const id = String(p.partnerId)
                      setSelected((s) => (e.target.checked ? [...s, id] : s.filter((x) => x !== id)))
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  {String(p.fullName)} · {String(p.partnerCode)}
                </td>
                <td className="px-3 py-2">₹{Number(p.amount || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs">{String(p.upiId || (p.bank as { accountNumber?: string })?.accountNumber || '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input className="rounded border px-3 py-2 text-sm" placeholder="UTR / transaction ref" value={utr} onChange={(e) => setUtr(e.target.value)} />
        <button
          type="button"
          className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={!selected.length || !utr.trim()}
          onClick={async () => {
            const r = await adminPartnerService.processPayouts(selected, utr.trim())
            setMsg(`Processed ${(r as { processed?: number }).processed || 0} payout(s)`)
            setSelected([])
            setUtr('')
            load()
          }}
        >
          Process payout
        </button>
      </div>
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
    </div>
  )
}
