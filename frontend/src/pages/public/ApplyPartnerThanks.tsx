import { Link, useLocation } from 'react-router-dom'

export function ApplyPartnerThanks() {
  const loc = useLocation()
  const state = (loc.state || {}) as { applicationId?: string; name?: string }
  const ref = state.applicationId || 'APP-…'
  const name = state.name || 'there'

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-brand-navy">Application received</h1>
      <p className="mt-4 text-slate-gray">
        Thanks {name}! We received your application. Reference number: <strong className="text-brand-navy">{ref}</strong>.
      </p>
      <p className="mt-2 text-sm text-slate-gray">Our team will review it within 3 working days and email you.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to="/apply-partner/status" className="rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white">
          Track status
        </Link>
        <Link to="/" className="rounded-lg border px-5 py-2.5 text-sm">
          Back to home
        </Link>
      </div>
    </div>
  )
}
