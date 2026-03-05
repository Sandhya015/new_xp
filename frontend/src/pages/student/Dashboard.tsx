import { Link } from 'react-router-dom'
import {
  BookOpen,
  Loader2,
  CheckCircle,
  Briefcase,
  Award,
  TrendingUp,
  RefreshCw,
  Zap,
  FileText,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const STAT_CARDS = [
  { value: 3, label: 'Trainings Enrolled', icon: BookOpen, color: 'bg-blue-500 text-white' },
  { value: 2, label: 'Ongoing', icon: Loader2, color: 'bg-amber-500 text-white' },
  { value: 1, label: 'Completed', icon: CheckCircle, color: 'bg-emerald-500 text-white' },
  { value: 2, label: 'Internships Applied', icon: Briefcase, color: 'bg-violet-500 text-white' },
  { value: 1, label: 'Certificates', icon: Award, color: 'bg-red-500 text-white' },
]

const PROGRESS_ITEMS = [
  { name: 'Web Development', percent: 65 },
  { name: 'Python Programming', percent: 30 },
  { name: 'Digital Marketing', percent: 100 },
]

const RECENT_ACTIVITY = [
  { text: 'Enrolled in Web Development', icon: FileText, iconColor: 'text-blue-600', time: '2 days ago' },
  { text: 'Payment of ₹1,499 successful', icon: CheckCircle, iconColor: 'text-emerald-600', time: '5 days ago' },
  { text: 'Applied for Data Science Intern', icon: Briefcase, iconColor: 'text-violet-600', time: '1 week ago' },
  { text: 'Certificate generated - Digital Marketing', icon: Award, iconColor: 'text-red-600', time: '2 weeks ago' },
]

const QUICK_ACTIONS = [
  { to: '/training', label: 'Explore Trainings', icon: BookOpen, primary: true },
  { to: '/dashboard/internships', label: 'Apply Internship', icon: Briefcase, primary: false },
  { to: '/dashboard/certificates', label: 'View Certificates', icon: Award, primary: false },
  { to: '/dashboard/invoices', label: 'Download Invoice', icon: FileText, primary: false },
]

export function Dashboard() {
  const { user } = useAuth()
  const displayName = user?.name ?? 'Student'
  const profileComplete = 72

  return (
    <div className="space-y-6 w-full">
      {/* Welcome banner + profile completion */}
      <div className="rounded-xl bg-gradient-to-r from-brand-accent to-primary-600 px-6 py-5 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Welcome, {displayName}! 👋</h2>
            <p className="mt-1 text-sm text-white/90">
              Continue your learning journey and build your career.
            </p>
          </div>
          <div className="shrink-0 w-full sm:w-48">
            <p className="text-xs font-medium text-white/90">Profile Completion</p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${profileComplete}%` }}
              />
            </div>
            <p className="mt-1 text-sm font-semibold">{profileComplete}%</p>
          </div>
        </div>
      </div>

      {/* Summary cards: icon left, number beside, note below */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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

      {/* Learning Progress + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-accent" />
            <h3 className="font-bold text-brand-navy">Learning Progress</h3>
          </div>
          <div className="mt-4 space-y-4">
            {PROGRESS_ITEMS.map(({ name, percent }) => (
              <div key={name}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{name}</span>
                  <span className="text-slate-gray">{percent}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand-accent transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-brand-accent" />
            <h3 className="font-bold text-brand-navy">Recent Activity</h3>
          </div>
          <ul className="mt-4 space-y-3">
            {RECENT_ACTIVITY.map(({ text, icon: Icon, iconColor, time }) => (
              <li key={text} className="flex items-start gap-3">
                <div className={`shrink-0 mt-0.5 ${iconColor}`}>
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
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-brand-accent" />
          <h3 className="font-bold text-brand-navy">Quick Actions</h3>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {QUICK_ACTIONS.map(({ to, label, icon: Icon, primary }) => (
            <Link
              key={label}
              to={to}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                primary
                  ? 'bg-brand-accent text-white hover:bg-primary-600 shadow-sm'
                  : 'border-2 border-brand-accent text-brand-accent hover:bg-brand-light-bg'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
