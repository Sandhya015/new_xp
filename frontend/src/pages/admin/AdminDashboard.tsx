import { Link } from 'react-router-dom'
import {
  GraduationCap,
  BookOpen,
  Building2,
  Briefcase,
  IndianRupee,
  Award,
  TrendingDown,
  Clock,
  BarChart3,
  Zap,
  Upload,
  Download,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'

const KPI_CARDS = [
  { value: '1,248', label: 'Total Students', icon: GraduationCap, color: 'bg-blue-500 text-white' },
  { value: '45', label: 'Trainings', icon: BookOpen, color: 'bg-emerald-500 text-white' },
  { value: '28', label: 'Companies', icon: Building2, color: 'bg-violet-500 text-white' },
  { value: '120', label: 'Internships', icon: Briefcase, color: 'bg-amber-500 text-white' },
  { value: '₹12.4L', label: 'Total Revenue', icon: IndianRupee, color: 'bg-emerald-600 text-white' },
  { value: '892', label: 'Certs Generated', icon: Award, color: 'bg-red-500 text-white' },
  { value: '24', label: 'New Leads', icon: TrendingDown, color: 'bg-amber-500 text-white' },
  { value: '8', label: 'Pending Approvals', icon: Clock, color: 'bg-gray-600 text-white' },
]

const QUICK_ACTIONS = [
  { to: '/admin/courses', label: 'Upload Training', icon: Upload },
  { to: '/admin/certificates', label: 'Generate Certificates', icon: Award },
  { to: '/admin/leads', label: 'View Leads', icon: TrendingDown },
  { label: 'Export Data', icon: Download, to: '#' },
  { to: '/admin/companies', label: 'Approve Companies', icon: CheckCircle },
]

const RECENT_ACTIVITY = [
  { activity: 'New student registered', user: 'Rahul Kumar (BEU)', time: '5 min ago', type: 'Student' },
  { activity: 'Certificate generated', user: 'Priya S.', time: '12 min ago', type: 'Certificate' },
  { activity: 'Lead captured', user: 'Contact form', time: '1 hour ago', type: 'Lead' },
  { activity: 'Payment received', user: 'Amit Singh', time: '2 hours ago', type: 'Payment' },
]

export function AdminDashboard() {
  return (
    <div className="space-y-6 w-full">
      {/* KPI cards - 2 rows of 4 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {KPI_CARDS.map(({ value, label, icon: Icon, color }) => (
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
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Overview */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
            <BarChart3 className="h-5 w-5 text-brand-accent" />
            <h3 className="font-bold text-brand-navy">Revenue Overview</h3>
          </div>
          <div className="p-6">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 py-12">
              <BarChart3 className="h-12 w-12 text-gray-300 mb-2" />
              <p className="text-sm font-medium text-slate-gray">Monthly Revenue Chart (₹ in Lakhs)</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-brand-navy">₹2.1L</p>
                <p className="text-xs text-slate-gray">This Month</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-brand-navy">₹12.4L</p>
                <p className="text-xs text-slate-gray">Total</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-brand-navy">142</p>
                <p className="text-xs text-slate-gray">Orders</p>
              </div>
            </div>
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

      {/* Recent Activity */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
          <RefreshCw className="h-5 w-5 text-brand-accent" />
          <h3 className="font-bold text-brand-navy">Recent Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-slate-gray font-medium">
                <th className="px-5 py-3">Activity</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_ACTIVITY.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-900">{row.activity}</td>
                  <td className="px-5 py-3 text-gray-700">{row.user}</td>
                  <td className="px-5 py-3 text-slate-gray">{row.time}</td>
                  <td className="px-5 py-3 text-slate-gray">{row.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
