import { CheckSquare } from 'lucide-react'

export function SelectedCandidates() {
  return (
    <div className="max-w-4xl">
      <p className="text-sm text-slate-gray mb-4">View candidates selected for internships.</p>
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <CheckSquare className="mx-auto h-12 w-12 text-gray-300" />
        <h2 className="mt-3 text-lg font-bold text-brand-navy">Selected Candidates</h2>
        <p className="mt-1 text-sm text-slate-gray">Selected candidates list will go here.</p>
      </div>
    </div>
  )
}
