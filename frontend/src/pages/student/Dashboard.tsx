import { Link } from 'react-router-dom'
import {
  BookOpen,
  Briefcase,
  Award,
  CreditCard,
  FileText,
  CheckCircle,
  Zap,
  User,
  Play,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const STAT_CARDS = [
  { value: 3, label: 'Enrolled Trainings', icon: BookOpen, color: 'bg-blue-500 text-white' },
  { value: 2, label: 'Applied Internships', icon: Briefcase, color: 'bg-violet-500 text-white' },
  { value: 1, label: 'Certificates Earned', icon: Award, color: 'bg-emerald-500 text-white' },
  { value: 0, label: 'Pending Payments', icon: CreditCard, color: 'bg-amber-500 text-white' },
]

const RECENT_ACTIVITY = [
  { text: 'Enrolled in Web Development', icon: FileText, iconColor: 'text-blue-600', time: '2 days ago' },
  { text: 'Payment of ₹1,499 successful', icon: CheckCircle, iconColor: 'text-emerald-600', time: '5 days ago' },
  { text: 'Applied for Data Science Intern', icon: Briefcase, iconColor: 'text-violet-600', time: '1 week ago' },
  { text: 'Certificate generated — Digital Marketing', icon: Award, iconColor: 'text-red-600', time: '2 weeks ago' },
]

const QUICK_ACTIONS = [
  { to: '/dashboard/training', label: 'Explore Training', icon: BookOpen, primary: true },
  { to: '/dashboard/internships', label: 'Explore Internships', icon: Briefcase, primary: true },
  { to: '/dashboard/certificates', label: 'My Certificates', icon: Award, primary: false },
  { to: '/dashboard/profile', label: 'My Profile', icon: User, primary: false },
]

const ONGOING_PROGRESS = [
  { id: '1', name: 'Web Development', percent: 65, nextTask: 'Assignment 2 — Due Mar 10' },
  { id: '2', name: 'Python Programming', percent: 30, nextTask: 'Live class — Mar 8, 10 AM' },
]

export function Dashboard() {
  const { user } = useAuth()
  const displayName = user?.name ?? 'Student'
  const profileComplete = 72
  const university = 'BEU'
  const course = 'B.Tech CSE'
  const semester = '6th Sem'

  return (
    <div className="space-y-6 w-full">
      {/* Welcome banner — doc 3.1 */}
      <div className="rounded-xl bg-gradient-to-r from-brand-accent to-primary-600 px-6 py-5 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Welcome back, {displayName}!</h2>
            <p className="mt-1 text-sm text-white/90">
              {university} · {course} · {semester}
            </p>
          </div>
          <div className="shrink-0 w-full sm:w-52">
            <p className="text-xs font-medium text-white/90">Profile completion</p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${profileComplete}%` }}
              />
            </div>
            <p className="mt-1 text-sm font-semibold">{profileComplete}%</p>
            {profileComplete < 80 && (
              <p className="mt-1 text-xs text-white/80">Complete your profile to unlock all features.</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats cards — doc 3.2: 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        {/* Ongoing training progress — doc 3.5 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-accent" />
            <h3 className="font-bold text-brand-navy">Ongoing Training Progress</h3>
          </div>
          <div className="mt-4 space-y-4">
            {ONGOING_PROGRESS.length === 0 ? (
              <p className="text-sm text-slate-gray">No ongoing trainings. Explore programs to enroll.</p>
            ) : (
              ONGOING_PROGRESS.map(({ id, name, percent, nextTask }) => (
                <div key={id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-gray-800">{name}</span>
                    <span className="text-sm text-slate-gray">{percent}%</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand-accent transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-gray">{nextTask}</p>
                  <Link
                    to={`/dashboard/my-courses/${id}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent hover:underline"
                  >
                    <Play className="h-3.5 w-3.5" /> Continue
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activity — doc 3.3 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-brand-navy">Recent Activity</h3>
            <Link to="/dashboard/notifications" className="text-sm font-medium text-brand-accent hover:underline">
              View All
            </Link>
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

      {/* Quick access — doc 3.4 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-brand-accent" />
          <h3 className="font-bold text-brand-navy">Quick Access</h3>
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
