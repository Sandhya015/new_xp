import { useEffect, useState } from 'react'
import { partnerService } from '@/services/partnerService'
import { useAuthStore } from '@/store/authStore'

function MiniSpark({ points, color = '#0d9488' }: { points: Array<{ date: string; value: number }>; color?: string }) {
  if (!points.length) return <p className="text-xs text-slate-gray">No chart data yet</p>
  const max = Math.max(...points.map((p) => p.value), 1)
  const w = 320
  const h = 80
  const path = points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * w
      const y = h - (p.value / max) * (h - 8) - 4
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  )
}

export function PartnerOverview() {
  const [data, setData] = useState<{
    partner: Record<string, unknown>
    stats: Record<string, number | Array<{ date: string; value: number }>>
  } | null>(null)

  useEffect(() => {
    partnerService.me().then(setData).catch(() => setData(null))
  }, [])

  const s = data?.stats || {}
  const num = (k: string) => Number(s[k] ?? 0)
  const name = String(data?.partner?.fullName || 'Partner')
  const earnSeries = (Array.isArray(s.chartEarnings) ? s.chartEarnings : []) as Array<{ date: string; value: number }>
  const clickSeries = (Array.isArray(s.chartClicks) ? s.chartClicks : []) as Array<{ date: string; value: number }>

  const cards = [
    { label: 'Total Clicks', value: num('totalClicks') },
    { label: 'Successful Referrals', value: num('successfulReferrals'), cap: `this month: ${num('thisMonthSuccessful')}` },
    { label: 'Total Earnings', value: `₹${num('totalEarnings').toLocaleString()}`, cap: `this month: ₹${num('thisMonthEarnings').toLocaleString()}` },
    { label: 'Pending Payout', value: `₹${num('pendingPayout').toLocaleString()}` },
    { label: 'Paid Out', value: `₹${num('paidOut').toLocaleString()}` },
    { label: 'Conversion', value: `${num('conversionRate')}%` },
  ]

  return (
    <div className="space-y-6 pb-16 md:pb-0">
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900">
        Welcome back, {name}! You have earned ₹{num('thisMonthEarnings').toLocaleString()} this month.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-gray">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-brand-navy">{c.value}</p>
            {c.cap ? <p className="text-[11px] text-slate-gray">{c.cap}</p> : null}
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm font-medium text-brand-navy mb-2">Earnings (30 days)</p>
          <MiniSpark points={earnSeries} />
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm font-medium text-brand-navy mb-2">Clicks (30 days)</p>
          <MiniSpark points={clickSeries} color="#2563eb" />
        </div>
      </div>
      <p className="text-xs text-slate-gray">
        Commissions are held {num('holdDays') || 15} days before becoming eligible. Minimum payout ₹{num('minPayout') || 500}.
      </p>
    </div>
  )
}

function ShareMenu({ url, label }: { url: string; label: string }) {
  const share = (channel: string) => {
    const text = encodeURIComponent(`Check out XpertIntern trainings: ${url}`)
    const u = encodeURIComponent(url)
    const map: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${text}`,
      telegram: `https://t.me/share/url?url=${u}&text=${text}`,
      email: `mailto:?subject=${encodeURIComponent(label)}&body=${text}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}`,
    }
    if (map[channel]) window.open(map[channel], '_blank', 'noopener,noreferrer')
  }
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <button type="button" className="rounded border px-2 py-1 text-[11px]" onClick={() => void navigator.clipboard.writeText(url)}>
        Copy
      </button>
      {(['whatsapp', 'telegram', 'email', 'twitter'] as const).map((c) => (
        <button key={c} type="button" className="rounded border px-2 py-1 text-[11px] capitalize" onClick={() => share(c)}>
          {c}
        </button>
      ))}
      <a href={qr} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-[11px]">
        QR code
      </a>
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
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-brand-navy">{String(l.label)}</p>
              <p className="text-xs text-slate-gray capitalize">
                {String(l.linkType).replace('_', ' ')} {l.trainingTitle ? `· ${String(l.trainingTitle)}` : ''}
              </p>
              <p className="mt-1 break-all text-xs font-mono text-gray-700">{String(l.url)}</p>
              <ShareMenu url={String(l.url || '')} label={String(l.label || 'XpertIntern')} />
            </div>
            {l.url ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(String(l.url))}`}
                alt="QR"
                className="h-24 w-24 border rounded"
              />
            ) : null}
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
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    partnerService.payouts().then((r) => {
      setItems(r.items || [])
      setStats(r.stats || {})
    }).catch(() => undefined)
  }, [])

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
              <th className="px-3 py-2" />
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
                <td className="px-3 py-2 text-right">
                  <button type="button" className="text-brand-accent text-[11px]" onClick={() => void downloadReceipt(String(p.payoutId))}>
                    PDF
                  </button>
                </td>
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
  const [pw, setPw] = useState({ current: '', next: '' })
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
      <div className="border-t pt-4 space-y-2">
        <p className="text-sm font-medium">Change password</p>
        <input type="password" className="w-full rounded border px-3 py-2 text-sm" placeholder="Current password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
        <input type="password" className="w-full rounded border px-3 py-2 text-sm" placeholder="New password (min 8)" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm"
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
      {url ? (
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs">Your main link: <span className="font-mono">{url}</span></p>
          <ShareMenu url={url} label="XpertIntern" />
        </div>
      ) : null}
      {items.map((it) => (
        <div key={String(it.id)} className="rounded-xl border bg-white p-4">
          <p className="font-medium">{String(it.title)}</p>
          <p className="mt-2 text-sm text-slate-gray whitespace-pre-wrap">{String(it.body)}</p>
          {it.url ? (
            <a href={String(it.url)} className="text-xs text-brand-accent mt-2 inline-block" target="_blank" rel="noreferrer">
              Open asset
            </a>
          ) : null}
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
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState('')
  return (
    <div className="space-y-3 pb-16 max-w-lg">
      <h1 className="text-lg font-semibold text-brand-navy">Support</h1>
      <p className="text-sm text-slate-gray">Submit a ticket to the XpertIntern partner team, or email partners@xpertintern.com</p>
      <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea className="w-full rounded border px-3 py-2 text-sm" rows={5} placeholder="Describe your request…" value={message} onChange={(e) => setMessage(e.target.value)} />
      <button
        type="button"
        className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
        onClick={async () => {
          const r = await partnerService.supportTicket(subject, message)
          setDone(r.message || 'Submitted')
          setSubject('')
          setMessage('')
        }}
      >
        Submit ticket
      </button>
      {done ? <p className="text-sm text-emerald-700">{done}</p> : null}
      <p className="text-xs text-slate-gray">Common requests: bank details, new link, coupon, payout issue.</p>
    </div>
  )
}
