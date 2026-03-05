import { Settings } from 'lucide-react'

export function SystemSettings() {
  return (
    <div className="max-w-4xl">
      <p className="text-sm text-slate-gray mb-4">Configure system-wide settings and preferences.</p>
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <Settings className="mx-auto h-12 w-12 text-gray-300" />
        <h2 className="mt-3 text-lg font-bold text-brand-navy">System Settings</h2>
        <p className="mt-1 text-sm text-slate-gray">System configuration will go here.</p>
      </div>
    </div>
  )
}
