import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'

export function Internships() {
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh] px-4 py-8">
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <Briefcase className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <h2 className="mt-4 sm:mt-6 text-xl font-bold text-brand-navy sm:text-2xl">Internships</h2>
        <p className="mt-2 font-medium text-brand-accent">Coming Soon</p>
        <p className="mt-2 text-sm text-slate-gray">
          We&apos;re preparing something amazing. Our internship module will connect you with partner companies and verified certificates.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/training"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-primary-600 transition"
          >
            Explore Trainings
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 min-h-[44px] text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
