import { useEffect, useState } from 'react'
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
import { companyService, type CompanyDashboardData } from '@/services/companyService'

const DEFAULT_COMPANY_NAME = 'TechSolutions Pvt. Ltd.'

const QUICK_ACTIONS = [
  { to: '/company/post-internship', label: 'Post New Internship', icon: Plus, primary: true },
  { to: '/company/applicants', label: 'View Applicants', icon: Users, primary: true },
  { to: '/company/internships', label: 'View Active Listings', icon: ListChecks, primary: true },
]

function formatActivityTime(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    return `${diffDays} days ago`
  } catch {
    return ''
  }
}

export function CompanyDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<CompanyDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    companyService
      .getDashboard()
      .then(setData)
      .catch(() => setError('Unable to load dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  const companyName = data?.companyName ?? user?.companyName ?? DEFAULT_COMPANY_NAME
  const accountStatus = data?.accountStatus ?? 'active'
  const profileComplete = data?.profileComplete ?? 0
  const stats = data?.stats
  const recentActivity = data?.recentActivity ?? []

  const statCards = stats
    ? [
        { value: stats.totalListings, label: 'Total Internships Posted', icon: ClipboardList, color: 'bg-blue-500 text-white' },
        { value: stats.activeListings, label: 'Active Listings', icon: CheckCircle, color: 'bg-emerald-500 text-white' },
        { value: stats.totalApplicants, label: 'Total Applicants', icon: Users, color: 'bg-violet-500 text-white' },
        { value: stats.shortlisted, label: 'Shortlisted Candidates', icon: Star, color: 'bg-amber-500 text-white' },
        { value: stats.selected, label: 'Selected Candidates', icon: UserCheck, color: 'bg-teal-500 text-white' },
        { value: stats.closedListings, label: 'Internships Closed', icon: XCircle, color: 'bg-gray-600 text-white' },
      ]
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-slate-gray">Loading dashboard...</p>
      </div>
    )
  }

  const statusLabel = accountStatus === 'active' ? 'Active' : accountStatus === 'pending' ? 'Pending Approval' : accountStatus === 'suspended' ? 'Suspended' : accountStatus

  return (
    <div className="space-y-6 w-full">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {accountStatus === 'pending' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Your account is under review by Xpertintern Admin. You can set up your profile but cannot post internships until approved.
        </div>
      )}
      {accountStatus === 'suspended' && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          Your account has been suspended. Contact Xpertintern support for assistance.
        </div>
      )}
      {/* Welcome banner — CD-WF-01 */}
      <div className="rounded-xl bg-gradient-to-r from-brand-accent to-primary-600 px-6 py-5 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Welcome back, {companyName}!</h2>
            <p className="mt-1 text-sm text-white/90 flex items-center gap-2">
              Account status:{' '}
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  accountStatus === 'active'
                    ? 'bg-white/20 text-white'
                    : accountStatus === 'pending'
                    ? 'bg-amber-400/30 text-white'
                    : 'bg-red-400/30 text-white'
                }`}
              >
                {statusLabel}
              </span>
            </p>
          </div>
          {profileComplete < 80 && accountStatus !== 'suspended' && (
            <div className="shrink-0 rounded-lg bg-amber-400/20 px-4 py-2 text-sm text-white">
              Complete your company profile to attract more applicants.
            </div>
          )}
        </div>
      </div>

      {/* Stats cards — CD-WF-01 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(({ value, label, icon: Icon, color }) => (
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
            {recentActivity.length === 0 ? (
              <li className="text-sm text-slate-gray">No recent activity.</li>
            ) : (
              recentActivity.map((act, idx) => (
                <li key={act.applicationId || act.internshipId || idx} className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5 text-brand-accent">
                    {act.type === 'application' ? <Users className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-700">{act.text}</p>
                    <p className="text-xs text-slate-gray">{formatActivityTime(act.createdAt)}</p>
                  </div>
                </li>
              ))
            )}
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
