import { Link } from 'react-router-dom'

export function CompanySupport() {
  return (
    <div className="max-w-4xl">
      <p className="text-sm text-slate-gray mb-4">Get help with your company account and internships.</p>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-gray">Support content and contact options will go here.</p>
        <Link to="/contact" className="mt-3 inline-block text-sm font-medium text-brand-accent hover:underline">
          Contact Us →
        </Link>
      </div>
    </div>
  )
}
