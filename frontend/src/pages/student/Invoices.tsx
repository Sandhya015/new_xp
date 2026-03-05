import { Link } from 'react-router-dom'

export function Invoices() {
  return (
    <div className="max-w-6xl space-y-6">
      <p className="text-sm text-slate-gray">Invoice list and download PDF. Data from API when connected.</p>
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-gray-600">No invoices yet.</p>
        <Link to="/training" className="mt-3 inline-block text-brand-accent font-semibold hover:underline">Enroll in a course</Link>
      </div>
    </div>
  )
}
