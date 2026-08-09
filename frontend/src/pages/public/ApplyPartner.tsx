import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { partnerService } from '@/services/partnerService'
import { INDIAN_STATES_UTS } from '@/constants/indianRegions'

export function ApplyPartner() {
  const navigate = useNavigate()
  const [meta, setMeta] = useState<{
    partnerTypes: string[]
    audienceSizes: string[]
    hearAbout: string[]
    recaptchaSiteKey?: string
    recaptchaEnabled?: boolean
  } | null>(null)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    country: 'India',
    partnerType: '',
    organisationName: '',
    websiteUrl: '',
    instagram: '',
    youtube: '',
    linkedin: '',
    audienceSize: '',
    priorAffiliateExperience: false,
    promotePlan: '',
    whyPartner: '',
    referredBy: '',
    heardAbout: '',
    agreedTerms: false,
  })
  const [emailVid, setEmailVid] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailOtp, setEmailOtp] = useState('')
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [resendCooldown])

  useEffect(() => {
    document.title = 'Become an Affiliate Partner | XpertIntern'
    const ensureMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.content = content
    }
    ensureMeta('description', 'Join the XpertIntern Affiliate Partner program. Promote university-aligned trainings and earn commission on successful enrollments.')
    ensureMeta('og:title', 'XpertIntern Affiliate Partner Program', 'property')
    ensureMeta('og:description', 'Apply to become an XpertIntern affiliate partner and earn on successful student enrollments.', 'property')
    partnerService.meta().then((m) => {
      setMeta(m)
      if (m.recaptchaEnabled && m.recaptchaSiteKey) {
        const id = 'recaptcha-v3'
        if (!document.getElementById(id)) {
          const s = document.createElement('script')
          s.id = id
          s.src = `https://www.google.com/recaptcha/api.js?render=${m.recaptchaSiteKey}`
          s.async = true
          document.head.appendChild(s)
        }
      }
    }).catch(() => setMeta({ partnerTypes: [], audienceSizes: [], hearAbout: [] }))
  }, [])

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const runRecaptcha = async (): Promise<string> => {
    const key = meta?.recaptchaSiteKey
    if (!key || !meta?.recaptchaEnabled) return ''
    const g = (window as unknown as { grecaptcha?: { execute: (k: string, o: { action: string }) => Promise<string> } }).grecaptcha
    if (!g?.execute) return ''
    try {
      return await g.execute(key, { action: 'partner_apply' })
    } catch {
      return ''
    }
  }

  const sendEmailOtp = async () => {
    setError(null)
    if (!form.email.trim()) {
      setError('Enter your email first.')
      return
    }
    if (resendCooldown > 0) return
    setBusy(true)
    try {
      const r = await partnerService.sendOtp('email', form.email)
      setEmailVid(r.verificationId)
      setEmailOtpSent(true)
      setResendCooldown(30)
      setToast({ message: `OTP sent to ${form.email.trim()}. Check your inbox.`, tone: 'success' })
    } catch (e: unknown) {
      const msg = apiErr(e, 'Could not send OTP')
      setError(msg)
      setToast({ message: msg, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const verifyEmailOtp = async () => {
    setBusy(true)
    setError(null)
    try {
      await partnerService.verifyOtp(emailVid, emailOtp)
      setEmailVerified(true)
      setToast({ message: 'Email verified successfully.', tone: 'success' })
    } catch (e: unknown) {
      const msg = apiErr(e, 'OTP verification failed')
      setError(msg)
      setToast({ message: msg, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    setError(null)
    if (!form.phone.trim()) {
      setError('Phone number is required.')
      return
    }
    if (!emailVerified) {
      setError('Please verify your email with OTP before submitting.')
      return
    }
    if (!form.agreedTerms) {
      setError('Please accept Partner Terms & Conditions.')
      return
    }
    if (form.promotePlan.trim().length < 50) {
      setError('Promotion plan must be at least 50 characters.')
      return
    }
    setBusy(true)
    try {
      const recaptchaToken = await runRecaptcha()
      const res = await partnerService.apply({
        ...form,
        emailVerificationId: emailVid,
        recaptchaToken: recaptchaToken || undefined,
      })
      navigate('/apply-partner/thanks', { state: { applicationId: res.applicationId, name: form.fullName } })
    } catch (e: unknown) {
      setError(apiErr(e, 'Submit failed'))
    } finally {
      setBusy(false)
    }
  }

  const faqs = [
    { q: 'Who can apply?', a: 'Colleges, coaching centres, influencers, YouTubers, student communities and individuals.' },
    { q: 'How much can I earn?', a: 'Commission is set per partner (typically up to 20%) on net paid enrollment amount.' },
    { q: 'When do I get paid?', a: 'Eligible commissions (after a 15-day hold) are paid monthly when above the minimum threshold.' },
    { q: 'How long does approval take?', a: 'Usually within 3 working days after you submit a complete application.' },
    { q: 'Can I use both links and coupons?', a: 'Yes — admin can create referral links and coupons for you after approval.' },
  ]

  return (
    <div className="bg-white">
      {toast ? (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.tone === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-600 text-white'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
      <section className="bg-gradient-to-br from-brand-navy via-slate-800 to-brand-navy px-4 py-16 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Earn with XpertIntern. Become an Affiliate Partner.</h1>
          <p className="mt-4 text-white/85">
            Colleges, coaching institutes, YouTubers, influencers and individuals — help students learn, earn a share on every enrollment.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Earn commission', 'Monthly payouts', 'Marketing kit', 'Live tracking dashboard'].map((t) => (
          <div key={t} className="rounded-xl border border-gray-200 p-4 text-center text-sm font-medium text-brand-navy shadow-sm">
            {t}
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-8">
        <h2 className="text-xl font-semibold text-brand-navy text-center">How it works</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-4 text-sm text-center">
          {['Apply', 'Get approved', 'Share link / coupon', 'Earn on referrals'].map((s, i) => (
            <li key={s} className="rounded-lg bg-gray-50 p-3">
              <span className="font-bold text-brand-accent">{i + 1}.</span> {s}
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-brand-navy">Application form</h2>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div>
            <h3 className="text-sm font-semibold text-gray-800">About you</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="Full name *" value={form.fullName} onChange={(v) => set('fullName', v)} />
              <div>
                <Field label="Email *" value={form.email} onChange={(v) => set('email', v)} disabled={emailVerified} />
                {!emailVerified ? (
                  <div className="mt-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy || !form.email || resendCooldown > 0}
                        onClick={() => void sendEmailOtp()}
                        className="text-xs font-medium text-brand-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : emailOtpSent ? 'Resend OTP' : 'Send OTP'}
                      </button>
                      {emailOtpSent ? (
                        <>
                          <input
                            className="flex-1 min-w-[6rem] rounded border px-2 py-1 text-xs"
                            placeholder="Enter OTP"
                            value={emailOtp}
                            onChange={(e) => setEmailOtp(e.target.value)}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                          />
                          <button type="button" disabled={busy || !emailOtp.trim()} onClick={() => void verifyEmailOtp()} className="text-xs font-semibold text-emerald-700 disabled:opacity-50">
                            Verify
                          </button>
                        </>
                      ) : null}
                    </div>
                    {emailOtpSent ? (
                      <p className="text-[11px] text-emerald-700">OTP sent — check your email (and spam folder).</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </p>
                )}
              </div>
              <div>
                <Field label="Phone *" value={form.phone} onChange={(v) => set('phone', v)} />
                <p className="mt-1 text-[11px] text-slate-gray">Mobile OTP verification is not required yet.</p>
              </div>
              <Field label="City *" value={form.city} onChange={(v) => set('city', v)} />
              <div>
                <label className="block text-xs font-medium text-gray-600">State *</label>
                <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.state} onChange={(e) => set('state', e.target.value)}>
                  <option value="">Select</option>
                  {INDIAN_STATES_UTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-800">About your reach</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600">Partner type *</label>
                <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.partnerType} onChange={(e) => set('partnerType', e.target.value)}>
                  <option value="">Select</option>
                  {(meta?.partnerTypes || []).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              {form.partnerType && form.partnerType !== 'Individual' ? (
                <Field label="Organisation / channel name" value={form.organisationName} onChange={(v) => set('organisationName', v)} />
              ) : null}
              <Field label="Website URL" value={form.websiteUrl} onChange={(v) => set('websiteUrl', v)} />
              <Field label="Instagram" value={form.instagram} onChange={(v) => set('instagram', v)} />
              <Field label="YouTube" value={form.youtube} onChange={(v) => set('youtube', v)} />
              <Field label="LinkedIn" value={form.linkedin} onChange={(v) => set('linkedin', v)} />
              <div>
                <label className="block text-xs font-medium text-gray-600">Audience size</label>
                <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.audienceSize} onChange={(e) => set('audienceSize', e.target.value)}>
                  <option value="">Select</option>
                  {(meta?.audienceSizes || []).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.priorAffiliateExperience} onChange={(e) => set('priorAffiliateExperience', e.target.checked)} />
                Prior affiliate experience
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-800">Your plan</h3>
            <div className="mt-2 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600">How will you promote XpertIntern? * (min 50 chars)</label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={4}
                  value={form.promotePlan}
                  onChange={(e) => set('promotePlan', e.target.value)}
                  placeholder="e.g. Share on my YouTube channel, college notice board, WhatsApp broadcast…"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Why partner with you? (optional, max 300)</label>
                <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={2} maxLength={300} value={form.whyPartner} onChange={(e) => set('whyPartner', e.target.value)} />
              </div>
              <Field label="Referred by (partner code)" value={form.referredBy} onChange={(v) => set('referredBy', v)} />
              <div>
                <label className="block text-xs font-medium text-gray-600">How did you hear about us?</label>
                <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={form.heardAbout} onChange={(e) => set('heardAbout', e.target.value)}>
                  <option value="">Select</option>
                  {(meta?.hearAbout || []).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={form.agreedTerms} onChange={(e) => set('agreedTerms', e.target.checked)} className="mt-1" />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" className="text-brand-accent underline">
                    Partner Terms & Conditions
                  </Link>
                </span>
              </label>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="w-full rounded-lg bg-brand-accent py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-10"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
              </span>
            ) : (
              'Submit Application'
            )}
          </button>
        </div>

        <div className="mt-12 space-y-2">
          <h2 className="text-lg font-semibold text-brand-navy">FAQ</h2>
          {faqs.map((f, i) => (
            <div key={f.q} className="rounded-lg border border-gray-200">
              <button type="button" className="flex w-full justify-between px-4 py-3 text-left text-sm font-medium" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                {f.q}
                <span>{faqOpen === i ? '−' : '+'}</span>
              </button>
              {faqOpen === i ? <p className="border-t px-4 py-3 text-sm text-slate-gray">{f.a}</p> : null}
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-gray">
          Have questions? Email{' '}
          <a href="mailto:partners@xpertintern.com" className="text-brand-accent">
            partners@xpertintern.com
          </a>
        </p>
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function apiErr(e: unknown, fallback: string) {
  if (e && typeof e === 'object' && 'response' in e) {
    return String((e as { response?: { data?: { error?: string } } }).response?.data?.error || fallback)
  }
  return fallback
}
