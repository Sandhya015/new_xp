import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Briefcase,
  Award,
  CreditCard,
  FileText,
  Zap,
  User,
  Play,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { enrollmentService } from '@/services/enrollmentService'
import { internshipService } from '@/services/internshipService'

const QUICK_ACTIONS = [
  { to: '/dashboard/training', label: 'Explore Training', icon: BookOpen, primary: true },
  { to: '/dashboard/internships', label: 'Explore Internships', icon: Briefcase, primary: true },
  { to: '/dashboard/certificates', label: 'My Certificates', icon: Award, primary: false },
  { to: '/dashboard/profile', label: 'My Profile', icon: User, primary: false },
]

function profileCompletionPercent(user: { name?: string; email?: string; university?: string; course?: string; semester?: string; collegeName?: string } | null): number {
  if (!user) return 0
  const fields = [user.name, user.email, user.university, user.course, user.semester, user.collegeName]
  const filled = fields.filter((f) => f && String(f).trim()).length
  return Math.round((filled / 6) * 100)
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [enrollments, setEnrollments] = useState<{ id: string; courseId: string; courseTitle: string; createdAt: string }[]>([])
  const [applications, setApplications] = useState<{ id: string; internshipTitle?: string; createdAt?: string }[]>([])
  const [loading, setLoading] = useState(true)

  const displayName = user?.name ?? 'Student'
  const university = user?.university ?? ''
  const course = user?.course ?? ''
  const semester = user?.semester ?? ''
  const profileComplete = profileCompletionPercent(user)

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setLoading(false)
      return
    }
    Promise.all([enrollmentService.list(), internshipService.myApplications()])
      .then(([enrollRes, appRes]) => {
        if (cancelled) return
        setEnrollments((enrollRes.items || []) as { id: string; courseId: string; courseTitle: string; createdAt: string }[])
        setApplications((appRes.items || []) as { id: string; internshipTitle?: string; createdAt?: string }[])
      })
      .catch((err) => {
        if (cancelled) return
        setEnrollments([])
        setApplications([])
        if (err?.response?.status === 401) {
          logout()
          navigate('/login', { replace: true })
          return
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user, logout, navigate])

  const enrolledCount = enrollments.length
  const appliedCount = applications.length
  const certificatesCount = 0
  const pendingPaymentsCount = 0

  const subtitle = [university, course, semester].filter(Boolean).join(' · ') || 'Complete your profile'

  type ActivityItem = { text: string; icon: typeof FileText; iconColor: string; time: string }
  const recentActivity: ActivityItem[] = []
  enrollments.slice(0, 3).forEach((e) => {
    recentActivity.push({
      text: `Enrolled in ${e.courseTitle || 'Course'}`,
      icon: FileText,
      iconColor: 'text-blue-600',
      time: e.createdAt ? formatRelative(e.createdAt) : '',
    })
  })
  applications.slice(0, 3).forEach((a) => {
    const app = a as { title?: string; internshipTitle?: string; createdAt?: string }
    recentActivity.push({
      text: `Applied for ${app.title || app.internshipTitle || 'Internship'}`,
      icon: Briefcase,
      iconColor: 'text-violet-600',
      time: app.createdAt ? formatRelative(app.createdAt) : '',
    })
  })
  const recentActivitySlice = recentActivity.slice(0, 5)

  return (
    <div className="space-y-6 w-full">
      {/* Welcome banner */}
      <div className="rounded-xl bg-gradient-to-r from-brand-accent to-primary-600 px-6 py-5 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Welcome back, {displayName}!</h2>
            <p className="mt-1 text-sm text-white/90">{subtitle}</p>
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


      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={loading ? '—' : enrolledCount} label="Enrolled Trainings" icon={BookOpen} color="bg-blue-500 text-white" />
        <StatCard value={loading ? '—' : appliedCount} label="Applied Internships" icon={Briefcase} color="bg-violet-500 text-white" />
        <StatCard value={loading ? '—' : certificatesCount} label="Certificates Earned" icon={Award} color="bg-emerald-500 text-white" />
        <StatCard value={loading ? '—' : pendingPaymentsCount} label="Pending Payments" icon={CreditCard} color="bg-amber-500 text-white" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ongoing training progress */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-accent" />
            <h3 className="font-bold text-brand-navy">Ongoing Training Progress</h3>
          </div>
          <div className="mt-4 space-y-4">
            {loading ? (
              <p className="text-sm text-slate-gray">Loading...</p>
            ) : enrollments.length === 0 ? (
              <p className="text-sm text-slate-gray">No ongoing trainings. Explore programs to enroll.</p>
            ) : (
              enrollments.slice(0, 5).map((e) => (
                <div key={e.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-gray-800">{e.courseTitle || 'Course'}</span>
                    <span className="text-sm text-slate-gray">In progress</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: '50%' }} />
                  </div>
                  <Link
                    to={`/dashboard/my-courses/${e.courseId}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent hover:underline"
                  >
                    <Play className="h-3.5 w-3.5" /> Continue
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-brand-navy">Recent Activity</h3>
            <Link to="/dashboard/notifications" className="text-sm font-medium text-brand-accent hover:underline">
              View All
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {loading ? (
              <li className="text-sm text-slate-gray">Loading...</li>
            ) : recentActivitySlice.length === 0 ? (
              <li className="text-sm text-slate-gray">No recent activity.</li>
            ) : (
              recentActivitySlice.map((a, i) => {
                const Icon = a.icon
                return (
                <li key={`${a.text}-${i}`} className="flex items-start gap-3">
                  <div className={`shrink-0 mt-0.5 ${a.iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-700">{a.text}</p>
                    <p className="text-xs text-slate-gray">{a.time || '—'}</p>
                  </div>
                </li>
              )
              })
            )}
          </ul>
        </div>
      </div>

      {/* Quick access */}
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

function StatCard({
  value,
  label,
  icon: Icon,
  color,
}: {
  value: number | string
  label: string
  icon: typeof BookOpen
  color: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3">
      <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold text-brand-navy leading-tight">{value}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-gray">{label}</p>
      </div>
    </div>
  )
}

function formatRelative(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week(s) ago`
    return d.toLocaleDateString()
  } catch {
    return dateStr
  }
}
