import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { AffiliatePageWrap } from '@/components/partner/AffiliateLandingShell'

export function ApplyPartnerThanks() {
  const loc = useLocation()
  const state = (loc.state || {}) as { applicationId?: string; name?: string }
  const ref = state.applicationId || 'APP-…'
  const name = state.name || 'there'

  return (
    <AffiliatePageWrap>
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-[#0f172a]">Application received</h1>
        <p className="mt-4 text-slate-gray">
          Thanks {name}! We received your application. Reference number:{' '}
          <strong className="font-mono text-[#0f172a]">{ref}</strong>.
        </p>
        <p className="mt-2 text-sm text-slate-gray">Our team will review it within 3 working days and email you.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/apply-partner/status" className="rounded-xl bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
            Track status
          </Link>
          <Link to="/apply-partner" className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-gray-50">
            Back to partner page
          </Link>
        </div>
      </div>
    </AffiliatePageWrap>
  )
}
