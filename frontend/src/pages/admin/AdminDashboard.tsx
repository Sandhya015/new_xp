import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap,
  BookOpen,
  Building2,
  Briefcase,
  IndianRupee,
  Award,
  MessageSquare,
  Clock,
  UserCheck,
  BarChart3,
  Zap,
  Plus,
  CheckCircle,
} from 'lucide-react'
import { adminService } from '@/services/adminService'

const KPI_CONFIG = [
  { key: 'totalStudents', label: 'Total Students', sub: 'Registered', icon: GraduationCap, color: 'bg-blue-500 text-white', format: (n: number) => n.toLocaleString() },
  { key: 'totalTrainings', label: 'Total Trainings', sub: 'Active programs', icon: BookOpen, color: 'bg-emerald-500 text-white', format: (n: number) => n.toLocaleString() },
  { key: 'totalCompanies', label: 'Total Companies', sub: 'Approved', icon: Building2, color: 'bg-violet-500 text-white', format: (n: number) => n.toLocaleString() },
  { key: 'totalInternships', label: 'Total Internships', sub: 'Active listings', icon: Briefcase, color: 'bg-amber-500 text-white', format: (n: number) => n.toLocaleString() },
  { key: 'totalRevenue', label: 'Total Revenue', sub: 'All time', icon: IndianRupee, color: 'bg-emerald-600 text-white', format: (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString()}` },
  { key: 'revenueThisMonth', label: 'Revenue This Month', sub: 'Current month', icon: IndianRupee, color: 'bg-teal-500 text-white', format: (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString()}` },
  { key: 'certificatesGenerated', label: 'Certificates', sub: 'Generated', icon: Award, color: 'bg-red-500 text-white', format: (n: number) => n.toLocaleString() },
  { key: 'newLeads7Days', label: 'New Leads', sub: 'Last 7 days', icon: MessageSquare, color: 'bg-orange-500 text-white', format: (n: number) => n.toLocaleString() },
  { key: 'pendingApprovals', label: 'Pending Approvals', sub: 'Requires action', icon: Clock, color: 'bg-gray-600 text-white', format: (n: number) => n.toLocaleString() },
  { key: 'activeEnrollments', label: 'Active Enrollments', sub: 'Students in training', icon: UserCheck, color: 'bg-indigo-500 text-white', format: (n: number) => n.toLocaleString() },
]

const ICON_MAP: Record<string, typeof GraduationCap> = {
  student: GraduationCap,
  lead: MessageSquare,
  payment: IndianRupee,
  certificate: Award,
  company: Building2,
}

const QUICK_ACTIONS = [
  { to: '/admin/courses', label: 'Add New Training', icon: Plus },
  { to: '/admin/certificates', label: 'Generate Certificates', icon: Award },
  { to: '/admin/companies?tab=pending', label: 'View Pending Approvals', icon: CheckCircle },
  { to: '/admin/leads', label: 'View New Leads', icon: MessageSquare },
  { to: '/admin/notifications', label: 'Send Platform Notification', icon: Zap },
]

export function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpis, setKpis] = useState<Record<string, number>>({})
  const [pendingItems, setPendingItems] = useState<Array<{ label: string; count: number; to: string }>>([])
  const [recentActivity, setRecentActivity] = useState<Array<{ type: string; text: string; time: string; entityId: string }>>([])

  useEffect(() => {
    adminService.getDashboard()
      .then((d) => {
        setKpis(d.kpis || {})
        setPendingItems(d.pendingItems || [])
        setRecentActivity(d.recentActivity || [])
      })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-6 text-slate-gray">Loading dashboard…</div>
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="space-y-6 w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {KPI_CONFIG.map(({ key, label, sub, icon: Icon, color, format }) => (
          <div
            key={key}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3"
          >
            <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-brand-navy leading-tight">{format(kpis[key] ?? 0)}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-gray">{label}</p>
              {sub && <p className="text-[10px] text-slate-gray mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-brand-navy flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pending Approvals
          </h3>
          <ul className="mt-4 space-y-2">
            {pendingItems.map(({ label, count, to }) => (
              <li key={label}>
                <Link
                  to={to}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition"
                >
                  <span className="flex items-center gap-2 text-gray-700">{label}</span>
                  {count > 0 ? (
                    <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-semibold text-white">{count}</span>
                  ) : (
                    <span className="text-slate-gray text-xs">0</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Revenue chart placeholder — doc 4.5 */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-brand-navy flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-accent" />
            Revenue & Enrollment
          </h3>
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 py-12">
            <BarChart3 className="h-12 w-12 text-gray-300 mb-2" />
            <p className="text-sm font-medium text-slate-gray">Monthly revenue (last 12 months) — chart loads from API</p>
            <p className="text-xs text-slate-gray mt-1">Bar: Top 5 trainings by enrollment</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-brand-navy">Recent Activity</h3>
          <p className="text-xs text-slate-gray mt-0.5">Last 15 platform events</p>
          <ul className="mt-4 space-y-3">
            {recentActivity.length === 0 ? (
              <li className="text-sm text-slate-gray">No recent activity.</li>
            ) : (
              recentActivity.map(({ text, time, type }, i) => {
                const Icon = ICON_MAP[type] || MessageSquare
                return (
                  <li key={`${i}-${time}`} className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5 text-brand-accent"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700">{text}</p>
                      <p className="text-xs text-slate-gray">{time}</p>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        {/* Quick actions — doc 4.4 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-brand-navy flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand-accent" />
            Quick Actions
          </h3>
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
