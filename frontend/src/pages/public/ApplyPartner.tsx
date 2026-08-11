import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Gift,
  Headphones,
  Instagram,
  Link2,
  Loader2,
  Mail,
  Megaphone,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
  Youtube,
} from 'lucide-react'
import { partnerService } from '@/services/partnerService'
import { INDIAN_STATES_UTS } from '@/constants/indianRegions'

const BENEFITS = [
  { title: 'Earn commission', desc: 'Rewarded for every successful student enrollment', icon: Wallet, bg: 'bg-blue-50', color: 'text-blue-600' },
  { title: 'Monthly payouts', desc: 'Simple, transparent and on-time settlements', icon: TrendingUp, bg: 'bg-orange-50', color: 'text-orange-600' },
  { title: 'Marketing kit', desc: 'Ready-to-share creatives, copy and campaign support', icon: Gift, bg: 'bg-violet-50', color: 'text-violet-600' },
  { title: 'Live dashboard', desc: 'Track referrals, conversions and earnings in real time', icon: BarChart3, bg: 'bg-emerald-50', color: 'text-emerald-600' },
]

const STEPS = [
  { title: 'Apply online', desc: 'Tell us about you and your audience', icon: User },
  { title: 'Get approved', desc: 'Our team reviews your profile', icon: BadgeCheck },
  { title: 'Share & promote', desc: 'Use your unique link or coupon', icon: Megaphone },
  { title: 'Earn rewards', desc: 'Get paid for verified enrollments', icon: TrendingUp },
]

const FAQS = [
  {
    q: 'Who can become an affiliate partner?',
    a: 'Colleges, coaching institutes, creators, YouTubers, student communities and individuals who want to help learners find practical training.',
  },
  {
    q: 'How much can I earn?',
    a: 'Your commission depends on the program and campaign. Every approved partner can view the applicable commission inside the partner dashboard.',
  },
  {
    q: 'When will I receive my payout?',
    a: 'Verified commissions are processed monthly according to the partner terms and the payout information in your dashboard.',
  },
  {
    q: 'How long does approval take?',
    a: 'Most complete applications are reviewed quickly. You will receive the decision and next steps on your registered email.',
  },
  {
    q: 'Can I use both referral links and coupons?',
    a: 'Yes. Approved partners can promote using their unique referral link and eligible coupon codes.',
  },
]

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
  const [faqOpen, setFaqOpen] = useState(0)

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

  const formProgress = useMemo(() => {
    const s1 = form.fullName && form.email && emailVerified && form.phone && form.city && form.state
    const s2 = form.partnerType
    const s3 = form.promotePlan.trim().length >= 50 && form.agreedTerms
    if (s3) return 3
    if (s2) return 2
    if (s1) return 1
    return 0
  }, [form, emailVerified])

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

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="bg-white">
      {toast ? (
        <div
          className={`fixed top-20 right-4 z-[60] max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-xl ${
            toast.tone === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-600 text-white'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0f2744] to-[#0a1628] text-white">
        <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> XpertIntern Affiliate Program
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.25rem]">
              Help students grow.
              <span className="mt-2 block text-cyan-300">Earn as they succeed.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/80 leading-relaxed">
              Partner with one of India&apos;s growing skill-development platforms. Share trusted internship programs with your community and earn on every successful enrollment.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => scrollTo('application')}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-primary-600 transition"
              >
                Become a partner
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollTo('how-it-works')}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                See how it works
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
              {['Verified programs', 'Free to join', 'Dedicated support'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-2xl border border-white/10 bg-white/95 p-5 text-[#0f172a] shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-gray">Partner overview</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                </span>
              </div>
              <p className="mt-3 text-lg font-bold">Welcome back, Priya</p>
              <div className="mt-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
                <p className="text-xs text-slate-gray">This month&apos;s earnings</p>
                <p className="mt-1 text-3xl font-bold text-[#0f172a]">₹18,450</p>
                <p className="mt-1 text-xs font-medium text-emerald-600">↑ 24% from last month</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[['Clicks', '1,248'], ['Enrollments', '37'], ['Conversion', '2.96%']].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-gray-50 py-2.5">
                    <p className="text-[10px] text-slate-gray">{l}</p>
                    <p className="text-sm font-bold">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-gray mb-2">
                  <span>Referral performance</span>
                  <span>Last 7 days</span>
                </div>
                <div className="flex h-16 items-end gap-1">
                  {[40, 55, 35, 70, 50, 85, 60].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-brand-accent/80" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-3 -right-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 shadow-lg text-xs">
              <p className="font-semibold text-emerald-700">New enrollment!</p>
              <p className="text-slate-gray">Commission added</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="scroll-mt-20 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-accent">Built for your growth</p>
            <h2 className="mt-3 text-3xl font-bold text-[#0f172a] sm:text-4xl">Everything you need to earn with confidence</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-gray">We provide the tools, visibility and support. You focus on reaching the right students.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {BENEFITS.map(({ title, desc, icon: Icon, bg, color }) => (
              <div key={title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#0f172a]">{title}</h3>
                <p className="mt-2 text-sm text-slate-gray leading-relaxed">{desc}</p>
                <p className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Included
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-gray-100 bg-gray-50/80 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-accent">Simple process</p>
            <h2 className="mt-3 text-3xl font-bold text-[#0f172a]">Start earning in four easy steps</h2>
          </div>
          <div className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute top-8 left-[12%] right-[12%] hidden h-0.5 bg-brand-accent/30 lg:block" />
            {STEPS.map(({ title, desc, icon: Icon }, i) => (
              <div key={title} className="relative text-center">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-200 bg-white shadow-sm">
                  <Icon className="h-7 w-7 text-brand-accent" />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-bold text-[#0f172a]">{title}</h3>
                <p className="mt-1 text-sm text-slate-gray">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application */}
      <section id="application" className="scroll-mt-20 bg-gradient-to-b from-blue-50/60 to-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 lg:items-start">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-accent">Join the partner network</p>
              <h2 className="mt-3 text-3xl font-bold text-[#0f172a] sm:text-4xl">Let&apos;s grow careers together</h2>
              <p className="mt-4 text-slate-gray leading-relaxed">
                Complete this short application. Our partnership team will review your details and connect with you.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  { t: 'No joining fee', d: 'Start without any upfront cost' },
                  { t: 'Fast review', d: 'Clear updates on your application' },
                  { t: 'Human support', d: 'A real partner manager to help' },
                ].map(({ t, d }) => (
                  <li key={t} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    <div>
                      <p className="font-semibold text-[#0f172a]">{t}</p>
                      <p className="text-sm text-slate-gray">{d}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/80 p-5">
                <div className="flex gap-3">
                  <Headphones className="h-5 w-5 shrink-0 text-brand-accent" />
                  <div>
                    <p className="font-semibold text-[#0f172a]">Need help applying?</p>
                    <a href="mailto:partners@xpertintern.com" className="text-sm font-medium text-brand-accent hover:underline">
                      partners@xpertintern.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-accent">Partner application</p>
                  <h3 className="mt-1 text-2xl font-bold text-[#0f172a]">Tell us about yourself</h3>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-slate-gray">~ 3 min</span>
              </div>

              <div className="mt-5 flex gap-1">
                {[1, 2, 3].map((n) => (
                  <div key={n} className={`h-1.5 flex-1 rounded-full ${formProgress >= n ? 'bg-brand-accent' : 'bg-gray-200'}`} />
                ))}
              </div>

              {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

              <div className="mt-8 space-y-8">
                <FormSection num={1} title="Basic information">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Full name *" placeholder="Enter your full name" value={form.fullName} onChange={(v) => set('fullName', v)} />
                    <div>
                      <label className="block text-xs font-semibold text-[#334155]">Email address *</label>
                      <div className="mt-1 flex gap-2">
                        <input
                          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm disabled:bg-gray-50"
                          placeholder="name@example.com"
                          value={form.email}
                          disabled={emailVerified}
                          onChange={(e) => set('email', e.target.value)}
                        />
                        {!emailVerified ? (
                          <button
                            type="button"
                            disabled={busy || !form.email || resendCooldown > 0}
                            onClick={() => void sendEmailOtp()}
                            className="shrink-0 rounded-xl bg-brand-accent/10 px-3 py-2 text-xs font-semibold text-brand-accent disabled:opacity-50"
                          >
                            {resendCooldown > 0 ? `${resendCooldown}s` : 'Send OTP'}
                          </button>
                        ) : null}
                      </div>
                      {!emailVerified && emailOtpSent ? (
                        <div className="mt-2 flex gap-2">
                          <input
                            className="flex-1 rounded-lg border px-2 py-1.5 text-xs"
                            placeholder="Enter OTP"
                            value={emailOtp}
                            onChange={(e) => setEmailOtp(e.target.value)}
                            inputMode="numeric"
                          />
                          <button type="button" disabled={busy || !emailOtp.trim()} onClick={() => void verifyEmailOtp()} className="text-xs font-semibold text-emerald-700">
                            Verify
                          </button>
                        </div>
                      ) : null}
                      {emailVerified ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                        </p>
                      ) : null}
                    </div>
                    <Field label="Phone number *" placeholder="+91 98765 43210" value={form.phone} onChange={(v) => set('phone', v)} />
                    <Field label="City *" placeholder="Enter your city" value={form.city} onChange={(v) => set('city', v)} />
                    <div className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
                      <label className="block text-xs font-semibold text-[#334155]">State *</label>
                      <select className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" value={form.state} onChange={(e) => set('state', e.target.value)}>
                        <option value="">Select your state</option>
                        {INDIAN_STATES_UTS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </FormSection>

                <FormSection num={2} title="Your reach">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[#334155]">Partner type *</label>
                      <select className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" value={form.partnerType} onChange={(e) => set('partnerType', e.target.value)}>
                        <option value="">Select partner type</option>
                        {(meta?.partnerTypes || []).map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <Field
                      label={form.partnerType === 'Individual' ? 'Organisation / channel (optional)' : 'Organisation / channel'}
                      placeholder="Name of your organisation"
                      value={form.organisationName}
                      onChange={(v) => set('organisationName', v)}
                    />
                    <IconField icon={Link2} label="Website URL" placeholder="https://" value={form.websiteUrl} onChange={(v) => set('websiteUrl', v)} />
                    <IconField icon={Instagram} label="Instagram" placeholder="@username" value={form.instagram} onChange={(v) => set('instagram', v)} />
                    <IconField icon={Youtube} label="YouTube" placeholder="Channel URL" value={form.youtube} onChange={(v) => set('youtube', v)} />
                    <div>
                      <label className="block text-xs font-semibold text-[#334155]">Audience size</label>
                      <select className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" value={form.audienceSize} onChange={(e) => set('audienceSize', e.target.value)}>
                        <option value="">Select audience range</option>
                        {(meta?.audienceSizes || []).map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </FormSection>

                <FormSection num={3} title="Your plan">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#334155]">How will you promote XpertIntern? *</label>
                      <textarea
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                        rows={4}
                        value={form.promotePlan}
                        onChange={(e) => set('promotePlan', e.target.value)}
                        placeholder="e.g. Share on my YouTube channel, college notice board, WhatsApp broadcast…"
                      />
                      <p className="mt-1 text-right text-[11px] text-slate-gray">Minimum 50 characters</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Referral code (optional)" placeholder="Partner code" value={form.referredBy} onChange={(v) => set('referredBy', v)} />
                      <div>
                        <label className="block text-xs font-semibold text-[#334155]">How did you hear about us?</label>
                        <select className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" value={form.heardAbout} onChange={(e) => set('heardAbout', e.target.value)}>
                          <option value="">Select source</option>
                          {(meta?.hearAbout || []).map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <label className="flex items-start gap-2.5 text-sm text-[#334155]">
                      <input type="checkbox" checked={form.agreedTerms} onChange={(e) => set('agreedTerms', e.target.checked)} className="mt-1 rounded border-gray-300" />
                      <span>
                        I agree to the{' '}
                        <Link to="/terms" className="font-medium text-brand-accent hover:underline">
                          Partner Terms & Conditions
                        </Link>{' '}
                        and privacy policy.
                      </span>
                    </label>
                  </div>
                </FormSection>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-primary-600 disabled:opacity-60 transition"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      Submit application <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-gray">
                  <Shield className="h-3.5 w-3.5" /> Your information is encrypted and securely handled.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-accent">Common questions</p>
              <h2 className="mt-3 text-3xl font-bold text-[#0f172a]">Everything you may want to know</h2>
              <p className="mt-4 text-slate-gray">Can&apos;t find your answer? Email our partner team and we&apos;ll be happy to help.</p>
              <a href="mailto:partners@xpertintern.com" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-accent hover:underline">
                <Mail className="h-4 w-4" /> Ask a question
              </a>
            </div>
            <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
              {FAQS.map((f, i) => (
                <div key={f.q}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
                  >
                    <span className="font-semibold text-[#0f172a]">{f.q}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-brand-accent transition ${faqOpen === i ? 'rotate-180' : ''}`} />
                  </button>
                  {faqOpen === i ? <p className="border-t border-gray-100 px-5 pb-4 text-sm leading-relaxed text-slate-gray">{f.a}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function FormSection({ num, title, children }: { num: number; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent text-sm font-bold text-white">{num}</span>
        <h4 className="text-base font-bold text-[#0f172a]">{title}</h4>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  className = '',
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-[#334155]">{label}</label>
      <input
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function IconField({
  icon: Icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon: typeof Link2
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#334155]">{label}</label>
      <div className="relative mt-1">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}

function apiErr(e: unknown, fallback: string) {
  if (e && typeof e === 'object' && 'response' in e) {
    return String((e as { response?: { data?: { error?: string } } }).response?.data?.error || fallback)
  }
  return fallback
}
