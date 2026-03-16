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
  CreditCard,
  HelpCircle,
} from 'lucide-react'

/**
 * Admin Dashboard Home — Part 5A §4. Platform KPIs, pending approvals, activity feed, quick actions.
 */
const KPI_CARDS = [
  { value: '1,248', label: 'Total Students', sub: '+42 this month', icon: GraduationCap, color: 'bg-blue-500 text-white' },
  { value: '45', label: 'Total Trainings', sub: 'Active programs', icon: BookOpen, color: 'bg-emerald-500 text-white' },
  { value: '28', label: 'Total Companies', sub: 'Approved', icon: Building2, color: 'bg-violet-500 text-white' },
  { value: '120', label: 'Total Internships', sub: 'Active listings', icon: Briefcase, color: 'bg-amber-500 text-white' },
  { value: '₹12.4L', label: 'Total Revenue', sub: 'All time', icon: IndianRupee, color: 'bg-emerald-600 text-white' },
  { value: '₹2.1L', label: 'Revenue This Month', sub: '+18% vs last month', icon: IndianRupee, color: 'bg-teal-500 text-white' },
  { value: '892', label: 'Certificates Generated', sub: 'Training + Internship', icon: Award, color: 'bg-red-500 text-white' },
  { value: '24', label: 'New Leads', sub: 'Last 7 days', icon: MessageSquare, color: 'bg-orange-500 text-white' },
  { value: '8', label: 'Pending Approvals', sub: 'Requires action', icon: Clock, color: 'bg-gray-600 text-white' },
  { value: '356', label: 'Active Enrollments', sub: 'Students in training', icon: UserCheck, color: 'bg-indigo-500 text-white' },
]

const PENDING_ITEMS = [
  { label: 'Pending Company Approvals', count: 3, to: '/admin/companies?tab=pending', icon: Building2 },
  { label: 'Pending Internship Listings', count: 2, to: '/admin/internships?tab=pending', icon: Briefcase },
  { label: 'Pending Refund Requests', count: 1, to: '/admin/payments?tab=refunds', icon: CreditCard },
  { label: 'Pending Support Tickets', count: 2, to: '/admin/leads', icon: HelpCircle },
  { label: 'Certificate Requests', count: 0, to: '/admin/certificates', icon: Award },
]

const RECENT_ACTIVITY = [
  { text: 'New student registered — Rahul Kumar (BEU)', entity: 'Student', time: '5 min ago', icon: GraduationCap },
  { text: 'Certificate generated for Priya S. — Web Dev Batch 1', entity: 'Certificate', time: '12 min ago', icon: Award },
  { text: 'Lead captured from Contact form — Amit Singh', entity: 'Lead', time: '1 hour ago', icon: MessageSquare },
  { text: 'Payment received — ₹4,999 from Neha R. (Data Science)', entity: 'Payment', time: '2 hours ago', icon: IndianRupee },
  { text: 'Company approved — TechSolutions Pvt. Ltd.', entity: 'Company', time: '3 hours ago', icon: Building2 },
  { text: 'Internship listing submitted for moderation — Digital Marketing Intern', entity: 'Internship', time: '4 hours ago', icon: Briefcase },
]

const QUICK_ACTIONS = [
  { to: '/admin/courses', label: 'Add New Training', icon: Plus },
  { to: '/admin/certificates', label: 'Generate Certificates', icon: Award },
  { to: '/admin/companies', label: 'View Pending Approvals', icon: CheckCircle },
  { to: '/admin/leads', label: 'View New Leads', icon: MessageSquare },
  { to: '/admin/notifications', label: 'Send Platform Notification', icon: Zap },
]

export function AdminDashboard() {
  return (
    <div className="space-y-6 w-full">
      {/* KPI cards — doc 4.1 (10 cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {KPI_CARDS.map(({ value, label, sub, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3"
          >
            <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-brand-navy leading-tight">{value}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-gray">{label}</p>
              {sub && <p className="text-[10px] text-slate-gray mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Approvals panel — doc 4.2 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-brand-navy flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pending Approvals
          </h3>
          <ul className="mt-4 space-y-2">
            {PENDING_ITEMS.map(({ label, count, to, icon: Icon }) => (
              <li key={label}>
                <Link
                  to={to}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition"
                >
                  <span className="flex items-center gap-2 text-gray-700">
                    <Icon className="h-4 w-4 text-slate-gray" />
                    {label}
                  </span>
                  {count > 0 ? (
                    <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-semibold text-white">
                      {count}
                    </span>
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
        {/* Recent Activity — doc 4.3 (last 15) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-brand-navy">Recent Activity</h3>
          <p className="text-xs text-slate-gray mt-0.5">Last 15 platform events</p>
          <ul className="mt-4 space-y-3">
            {RECENT_ACTIVITY.map(({ text, entity, time, icon: Icon }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 text-brand-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700">{text}</p>
                  <p className="text-xs text-slate-gray">{time} · {entity}</p>
                </div>
              </li>
            ))}
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
