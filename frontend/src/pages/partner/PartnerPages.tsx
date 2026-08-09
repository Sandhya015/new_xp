import { useEffect, useState } from 'react'
import { partnerService } from '@/services/partnerService'

export function PartnerOverview() {
  const [data, setData] = useState<{ partner: Record<string, unknown>; stats: Record<string, number> } | null>(null)

  useEffect(() => {
    partnerService.me().then(setData).catch(() => setData(null))
  }, [])

  const s = data?.stats || {}
  const name = String(data?.partner?.fullName || 'Partner')

  const cards = [
    { label: 'Total Clicks', value: s.totalClicks ?? 0 },
    { label: 'Successful Referrals', value: s.successfulReferrals ?? 0, cap: `this month: ${s.thisMonthSuccessful ?? 0}` },
    { label: 'Total Earnings', value: `₹${(s.totalEarnings ?? 0).toLocaleString()}`, cap: `this month: ₹${(s.thisMonthEarnings ?? 0).toLocaleString()}` },
    { label: 'Pending Payout', value: `₹${(s.pendingPayout ?? 0).toLocaleString()}` },
    { label: 'Paid Out', value: `₹${(s.paidOut ?? 0).toLocaleString()}` },
  ]

  return (
    <div className="space-y-6 pb-16 md:pb-0">
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900">
        Welcome back, {name}! You have earned ₹{(s.thisMonthEarnings ?? 0).toLocaleString()} this month.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-gray">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-brand-navy">{c.value}</p>
            {c.cap ? <p className="text-[11px] text-slate-gray">{c.cap}</p> : null}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-gray">
        Commissions are held {s.holdDays ?? 15} days before becoming eligible. Minimum payout ₹{s.minPayout ?? 500}.
      </p>
    </div>
  )
}

export function PartnerLinks() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  useEffect(() => {
    partnerService.links().then((r) => setItems(r.items || [])).catch(() => setItems([]))
  }, [])
  if (!items.length) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-gray">
        You don’t have any referral links yet. Contact your account manager or raise a request from Support.
      </div>
    )
  }
  return (
    <div className="space-y-4 pb-16">
      <h1 className="text-lg font-semibold text-brand-navy">My Referral Links</h1>
      {items.map((l) => (
        <div key={String(l.id)} className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-brand-navy">{String(l.label)}</p>
              <p className="text-xs text-slate-gray capitalize">{String(l.linkType).replace('_', ' ')} {l.trainingTitle ? `· ${String(l.trainingTitle)}` : ''}</p>
              <p className="mt-1 break-all text-xs font-mono text-gray-700">{String(l.url)}</p>
            </div>
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 text-xs font-medium"
              onClick={() => {
                void navigator.clipboard.writeText(String(l.url || ''))
              }}
            >
              Copy Link
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-gray">
            Clicks: {String(l.clicks)} · Unique: {String(l.uniqueVisitors)} · Sign-ups: {String(l.signups)} · Successful: {String(l.paymentsSuccess)} · Earnings: ₹
            {Number(l.earnings || 0).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}

export function PartnerCoupons() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  useEffect(() => {
    partnerService.coupons().then((r) => setItems(r.items || [])).catch(() => setItems([]))
  }, [])
  if (!items.length) {
    return <p className="text-sm text-slate-gray">No coupons assigned yet.</p>
  }
  return (
    <div className="space-y-4 pb-16">
      <h1 className="text-lg font-semibold text-brand-navy">My Coupons</h1>
      {items.map((c) => (
        <div key={String(c.id)} className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex justify-between gap-2">
            <p className="text-lg font-bold tracking-wide text-brand-navy">{String(c.code)}</p>
            <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => void navigator.clipboard.writeText(String(c.code || ''))}>
              Copy
            </button>
          </div>
          <p className="text-sm text-slate-gray">
            {c.discountType === 'flat' ? `₹${c.discountValue} off` : `${c.discountValue}% off`}
          </p>
          <p className="mt-2 text-xs">
            Successful: {String(c.successCount)} · Earnings: ₹{Number(c.earnings || 0).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}

export function PartnerReferrals() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  useEffect(() => {
    partnerService.referrals().then((r) => setItems(r.items || [])).catch(() => setItems([]))
  }, [])
  return (
    <div className="space-y-4 pb-16">
      <h1 className="text-lg font-semibold text-brand-navy">Referrals</h1>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Training</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Commission</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((r) => (
              <tr key={String(r.id)}>
                <td className="px-3 py-2 whitespace-nowrap">{String(r.date)}</td>
                <td className="px-3 py-2">{String(r.studentName)} · {String(r.studentEmail)}</td>
                <td className="px-3 py-2">{String(r.training)}</td>
                <td className="px-3 py-2">₹{Number(r.amount || 0).toLocaleString()}</td>
                <td className="px-3 py-2">₹{Number(r.commission || 0).toLocaleString()}</td>
                <td className="px-3 py-2 capitalize">{String(r.commissionStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? <p className="p-4 text-sm text-slate-gray">No referrals yet.</p> : null}
      </div>
    </div>
  )
}

export function PartnerPayouts() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  useEffect(() => {
    partnerService.payouts().then((r) => {
      setItems(r.items || [])
      setStats(r.stats || {})
    }).catch(() => undefined)
  }, [])
  return (
    <div className="space-y-4 pb-16">
      <h1 className="text-lg font-semibold text-brand-navy">Payouts</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Pending Payout" value={`₹${(stats.pendingPayout ?? 0).toLocaleString()}`} note="Paid on 5th if above minimum" />
        <Card label="In Hold Period" value={`₹${(stats.holdAmount ?? 0).toLocaleString()}`} note="15-day refund window" />
        <Card label="Total Paid" value={`₹${(stats.paidOut ?? 0).toLocaleString()}`} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Payout ID</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">UTR</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((p) => (
              <tr key={String(p.payoutId)}>
                <td className="px-3 py-2 font-mono">{String(p.payoutId)}</td>
                <td className="px-3 py-2">{String(p.date)}</td>
                <td className="px-3 py-2">₹{Number(p.amount || 0).toLocaleString()}</td>
                <td className="px-3 py-2">{String(p.method)}</td>
                <td className="px-3 py-2">{String(p.transactionRef)}</td>
                <td className="px-3 py-2 capitalize">{String(p.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? <p className="p-4 text-sm text-slate-gray">No payouts yet.</p> : null}
      </div>
    </div>
  )
}

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-gray">{label}</p>
      <p className="text-xl font-bold text-brand-navy">{value}</p>
      {note ? <p className="text-[11px] text-slate-gray">{note}</p> : null}
    </div>
  )
}

export function PartnerProfile() {
  const [partner, setPartner] = useState<Record<string, unknown> | null>(null)
  const [form, setForm] = useState({ fullName: '', city: '', state: '', organisationName: '', phone: '', pan: '', upiId: '', accountHolder: '', accountNumber: '', ifsc: '', bankName: '' })
  const [msg, setMsg] = useState('')
  useEffect(() => {
    partnerService.me().then((r) => {
      const p = r.partner
      setPartner(p)
      const bank = (p.bank || {}) as Record<string, string>
      setForm({
        fullName: String(p.fullName || ''),
        city: String(p.city || ''),
        state: String(p.state || ''),
        organisationName: String(p.organisationName || ''),
        phone: String(p.phone || ''),
        pan: String(p.pan || ''),
        upiId: String(p.upiId || ''),
        accountHolder: bank.accountHolder || '',
        accountNumber: bank.accountNumber || '',
        ifsc: bank.ifsc || '',
        bankName: bank.bankName || '',
      })
    }).catch(() => undefined)
  }, [])

  const save = async () => {
    await partnerService.updateProfile(form)
    setMsg('Saved. Bank/UPI changes need admin approval before payouts use them.')
  }

  return (
    <div className="max-w-xl space-y-4 pb-16">
      <h1 className="text-lg font-semibold text-brand-navy">Profile</h1>
      <p className="text-xs text-slate-gray">Partner ID: {String(partner?.partnerCode || '')} · Commission: {String(partner?.commissionPercent || '')}%</p>
      {partner?.bankPendingApproval ? (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">Bank details update waiting for admin approval.</p>
      ) : null}
      {Object.entries({ fullName: 'Full name', phone: 'Phone', organisationName: 'Organisation', city: 'City', state: 'State', pan: 'PAN', upiId: 'UPI ID', accountHolder: 'Account holder', accountNumber: 'Account number', ifsc: 'IFSC', bankName: 'Bank name' }).map(([k, label]) => (
        <div key={k}>
          <label className="text-xs text-gray-600">{label}</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={(form as Record<string, string>)[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
        </div>
      ))}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      <button type="button" onClick={() => void save()} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
        Save
      </button>
    </div>
  )
}

export function PartnerMarketing() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [url, setUrl] = useState('')
  useEffect(() => {
    partnerService.marketingKit().then((r) => {
      setItems(r.items || [])
      setUrl(r.mainReferralUrl || '')
    }).catch(() => undefined)
  }, [])
  return (
    <div className="space-y-4 pb-16">
      <h1 className="text-lg font-semibold text-brand-navy">Marketing Kit</h1>
      {url ? <p className="text-xs">Your main link: <span className="font-mono">{url}</span></p> : null}
      {items.map((it) => (
        <div key={String(it.id)} className="rounded-xl border bg-white p-4">
          <p className="font-medium">{String(it.title)}</p>
          <p className="mt-2 text-sm text-slate-gray whitespace-pre-wrap">{String(it.body)}</p>
          {it.type === 'caption' ? (
            <button type="button" className="mt-2 text-xs border rounded px-2 py-1" onClick={() => void navigator.clipboard.writeText(String(it.body || ''))}>
              Copy caption
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function PartnerSupport() {
  return (
    <div className="space-y-3 pb-16 max-w-lg">
      <h1 className="text-lg font-semibold text-brand-navy">Support</h1>
      <p className="text-sm text-slate-gray">Raise tickets from the main site support flow, or email:</p>
      <a href="mailto:partners@xpertintern.com" className="text-brand-accent font-medium">
        partners@xpertintern.com
      </a>
      <p className="text-sm">Common requests: bank details, new link, coupon, payout issue.</p>
    </div>
  )
}
