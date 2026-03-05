import { Link } from 'react-router-dom'

export function Support() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-bold text-brand-navy">Help & Support</h2>
      <p className="mt-1 text-sm text-slate-gray">Get help with your trainings and account.</p>
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-gray">Support content and contact options will go here.</p>
        <Link to="/contact" className="mt-3 inline-block text-sm font-medium text-brand-accent hover:underline">
          Contact Us →
        </Link>
      </div>
    </div>
  )
}
