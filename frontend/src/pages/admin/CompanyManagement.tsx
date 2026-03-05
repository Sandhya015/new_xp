import { Building2 } from 'lucide-react'

export function CompanyManagement() {
  return (
    <div className="max-w-4xl">
      <p className="text-sm text-slate-gray mb-4">Manage registered companies and approvals.</p>
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <Building2 className="mx-auto h-12 w-12 text-gray-300" />
        <h2 className="mt-3 text-lg font-bold text-brand-navy">Company Management</h2>
        <p className="mt-1 text-sm text-slate-gray">Company list and approval workflow will go here.</p>
      </div>
    </div>
  )
}
