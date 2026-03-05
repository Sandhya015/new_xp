import { Link } from 'react-router-dom'
import { Award } from 'lucide-react'

export function Certificates() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-bold text-brand-navy">My Certificates</h2>
      <p className="mt-1 text-sm text-slate-gray">View and download your verified certificates.</p>
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <Award className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 font-medium text-gray-600">No certificates yet</p>
        <p className="mt-1 text-sm text-slate-gray">Complete a training to earn your certificate.</p>
        <Link to="/training" className="mt-4 inline-block rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
          Explore Trainings
        </Link>
      </div>
    </div>
  )
}
