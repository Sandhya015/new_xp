import { Link } from 'react-router-dom'
import {
  ClipboardList,
  CheckCircle,
  Users,
  Star,
  UserCheck,
  XCircle,
  Zap,
  Plus,
  ListChecks,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const DEFAULT_COMPANY_NAME = 'TechSolutions Pvt. Ltd.'

const STAT_CARDS = [
  { value: 5, label: 'Total Internships Posted', icon: ClipboardList, color: 'bg-blue-500 text-white' },
  { value: 3, label: 'Active Listings', icon: CheckCircle, color: 'bg-emerald-500 text-white' },
  { value: 47, label: 'Total Applicants', icon: Users, color: 'bg-violet-500 text-white' },
  { value: 12, label: 'Shortlisted Candidates', icon: Star, color: 'bg-amber-500 text-white' },
  { value: 5, label: 'Selected Candidates', icon: UserCheck, color: 'bg-teal-500 text-white' },
  { value: 2, label: 'Internships Closed', icon: XCircle, color: 'bg-gray-600 text-white' },
]

const RECENT_ACTIVITY = [
  { text: 'New application received — Rahul K. for Web Dev Intern', icon: Users, time: '2 hours ago' },
  { text: 'Candidate Priya S. shortlisted for Data Science Intern', icon: Star, time: '5 hours ago' },
  { text: 'Internship "Full Stack Intern" published', icon: ClipboardList, time: '1 day ago' },
  { text: 'Listing "Marketing Intern" closed', icon: XCircle, time: '2 days ago' },
]

const QUICK_ACTIONS = [
  { to: '/company/post-internship', label: 'Post New Internship', icon: Plus, primary: true },
  { to: '/company/applicants', label: 'View Applicants', icon: Users, primary: true },
  { to: '/company/internships', label: 'View Active Listings', icon: ListChecks, primary: true },
]

export function CompanyDashboard() {
  const companyName = useAuth().user?.companyName ?? DEFAULT_COMPANY_NAME
  const accountStatus = 'Active' as const
  const profileComplete = 85

  return (
    <div className="space-y-6 w-full">
      {/* Welcome banner — doc 3.1 */}
      <div className="rounded-xl bg-gradient-to-r from-brand-accent to-primary-600 px-6 py-5 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Welcome back, {companyName}!</h2>
            <p className="mt-1 text-sm text-white/90 flex items-center gap-2">
              Account status:{' '}
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  accountStatus === 'Active'
                    ? 'bg-white/20 text-white'
                    : accountStatus === 'Pending Approval'
                    ? 'bg-amber-400/30 text-white'
                    : 'bg-red-400/30 text-white'
                }`}
              >
                {accountStatus}
              </span>
            </p>
          </div>
          {profileComplete < 80 && (
            <div className="shrink-0 rounded-lg bg-amber-400/20 px-4 py-2 text-sm text-white">
              Complete your company profile to attract more applicants.
            </div>
          )}
        </div>
      </div>

      {/* Stats cards — doc 3.2: 6 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {STAT_CARDS.map(({ value, label, icon: Icon, color }) => (
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent activity — doc 3.3 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-brand-navy">Recent Activity</h3>
            <Link to="/company/notifications" className="text-sm font-medium text-brand-accent hover:underline">
              View All
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {RECENT_ACTIVITY.map(({ text, icon: Icon, time }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 text-brand-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700">{text}</p>
                  <p className="text-xs text-slate-gray">{time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick actions — doc 3.4 */}
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
