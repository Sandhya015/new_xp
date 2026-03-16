import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'

/**
 * Student Dashboard — Notifications (Part 3A §10). Filters + list. API later.
 */
const FILTERS = ['All', 'Unread', 'Training', 'Internship', 'Certificates', 'Payments', 'System']

export function Notifications() {
  const [activeFilter, setActiveFilter] = useState('All')

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Notifications</h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <CheckCheck className="h-4 w-4" /> Mark All as Read
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activeFilter === f ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        <div className="p-6 text-center text-slate-gray">
          <Bell className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 font-medium text-gray-600">No notifications yet</p>
          <p className="mt-1 text-sm">Activity and updates will appear here when connected to the backend.</p>
        </div>
      </div>
    </div>
  )
}
