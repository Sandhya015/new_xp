import { Link } from 'react-router-dom'
import { Settings, Users } from 'lucide-react'

export function AttendanceHub() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Attendance Management</h1>
        <p className="mt-1 text-sm text-slate-gray">Configure internship hours, monitor student attendance, and bulk mark date ranges.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/admin/attendance/config"
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-brand-accent/40"
        >
          <Settings className="h-8 w-8 text-brand-accent" />
          <h2 className="mt-3 font-semibold text-brand-navy">Configuration</h2>
          <p className="mt-1 text-sm text-slate-gray">Total hours, daily hours, university valid date ranges.</p>
        </Link>
        <Link
          to="/admin/attendance/monitor"
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-brand-accent/40"
        >
          <Users className="h-8 w-8 text-brand-accent" />
          <h2 className="mt-3 font-semibold text-brand-navy">Attendance Monitor</h2>
          <p className="mt-1 text-sm text-slate-gray">View % per student, history, and bulk mark attendance.</p>
        </Link>
      </div>
    </div>
  )
}
