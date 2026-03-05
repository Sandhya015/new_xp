import { Users } from 'lucide-react'

export function Applicants() {
  return (
    <div className="max-w-4xl">
      <p className="text-sm text-slate-gray mb-4">Review and manage applicant submissions.</p>
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <Users className="mx-auto h-12 w-12 text-gray-300" />
        <h2 className="mt-3 text-lg font-bold text-brand-navy">Applicants</h2>
        <p className="mt-1 text-sm text-slate-gray">Applicant list and filters will go here.</p>
      </div>
    </div>
  )
}
