import { Link } from 'react-router-dom'
import {
  ClipboardList,
  CheckCircle,
  GraduationCap,
  Star,
  UserCheck,
  RefreshCw,
  Zap,
  Plus,
  Users,
  ListChecks,
  BarChart3,
} from 'lucide-react'

const KPI_CARDS = [
  { value: 5, label: 'Internships Posted', icon: ClipboardList, color: 'bg-blue-500 text-white' },
  { value: 3, label: 'Active', icon: CheckCircle, color: 'bg-emerald-500 text-white' },
  { value: 47, label: 'Applications', icon: GraduationCap, color: 'bg-violet-500 text-white' },
  { value: 12, label: 'Shortlisted', icon: Star, color: 'bg-amber-500 text-white' },
  { value: 5, label: 'Selected', icon: UserCheck, color: 'bg-red-500 text-white' },
]

const RECENT_APPLICATIONS = [
  { student: 'Rahul Kumar', role: 'Full Stack Developer', applied: '10 Feb', status: 'Shortlisted' as const },
  { student: 'Priya Sharma', role: 'Full Stack Developer', applied: '9 Feb', status: 'Under Review' as const },
  { student: 'Amit Singh', role: 'Data Science Intern', applied: '8 Feb', status: 'Pending' as const },
]

const STATUS_STYLES: Record<string, string> = {
  Shortlisted: 'bg-emerald-100 text-emerald-700',
  'Under Review': 'bg-sky-100 text-sky-700',
  Pending: 'bg-amber-100 text-amber-700',
}

const QUICK_ACTIONS = [
  { to: '/company/post-internship', label: 'Post New Internship', icon: Plus },
  { to: '/company/applicants', label: 'View Applicants', icon: Users },
  { to: '/company/internships', label: 'Manage Internships', icon: ListChecks },
  { to: '/company/reports', label: 'View Reports', icon: BarChart3 },
]

export function CompanyDashboard() {
  return (
    <div className="space-y-6 w-full">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {KPI_CARDS.map(({ value, label, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3"
          >
            <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold text-brand-navy leading-tight">{value}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-gray">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Applications */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="font-bold text-brand-navy">Recent Applications</h3>
            <RefreshCw className="h-5 w-5 text-brand-accent" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-slate-gray font-medium">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Applied</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_APPLICATIONS.map((row) => (
                  <tr key={row.student} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{row.student}</td>
                    <td className="px-5 py-3 text-gray-700">{row.role}</td>
                    <td className="px-5 py-3 text-slate-gray">{row.applied}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[row.status] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand-accent" />
            <h3 className="font-bold text-brand-navy">Quick Actions</h3>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
              <Link
                key={label}
                to={to}
                className="flex items-center gap-3 rounded-lg bg-brand-accent px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 transition shadow-sm"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
