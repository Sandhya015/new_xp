import { BarChart3 } from 'lucide-react'

export function Reports() {
  return (
    <div className="max-w-4xl">
      <p className="text-sm text-slate-gray mb-4">View analytics and reports for your internships.</p>
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
        <h2 className="mt-3 text-lg font-bold text-brand-navy">Reports</h2>
        <p className="mt-1 text-sm text-slate-gray">Charts and reports will go here.</p>
      </div>
    </div>
  )
}
