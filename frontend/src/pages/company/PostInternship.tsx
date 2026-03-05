import { Plus } from 'lucide-react'

export function PostInternship() {
  return (
    <div className="max-w-2xl">
      <p className="text-sm text-slate-gray mb-4">Create a new internship listing.</p>
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <Plus className="mx-auto h-12 w-12 text-gray-300" />
        <h2 className="mt-3 text-lg font-bold text-brand-navy">Post New Internship</h2>
        <p className="mt-1 text-sm text-slate-gray">Form to post internship will go here.</p>
      </div>
    </div>
  )
}
