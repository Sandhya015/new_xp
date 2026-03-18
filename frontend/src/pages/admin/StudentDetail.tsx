/**
 * Admin — Student detail (AD-WF-15). Tabs: Profile, Enrolled Trainings, Applied Internships, Certificates, Payments, Support Tickets, Activity Log. Actions: Suspend, Activate, etc.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  User,
  BookOpen,
  Briefcase,
  Award,
  CreditCard,
  HelpCircle,
  Clock,
  Shield,
  Mail,
  Trash2,
} from 'lucide-react'
import { adminService, type StudentDetail as StudentDetailType } from '@/services/adminService'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'enrolled', label: 'Enrolled Trainings', icon: BookOpen },
  { id: 'internships', label: 'Applied Internships', icon: Briefcase },
  { id: 'certificates', label: 'Certificates', icon: Award },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'support', label: 'Support Tickets', icon: HelpCircle },
  { id: 'activity', label: 'Activity Log', icon: Clock },
] as const

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<StudentDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('profile')
  const [showSuspend, setShowSuspend] = useState(false)

  useEffect(() => {
    if (!id) return
    adminService.getStudent(id).then(setStudent).catch(() => setStudent(null)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-6 text-slate-gray">Loading student…</div>
  if (!student) return <div className="p-6 text-red-600">Student not found.</div>

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Link to="/admin/students" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold text-brand-navy">Student Details</h2>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-brand-navy">{student.name || `Student #${id}`}</h3>
              <p className="text-sm text-slate-gray">{student.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Edit (Override)
            </button>
            <button type="button" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Reset Password
            </button>
            <button type="button" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Mail className="h-4 w-4 inline mr-1" /> Send Message
            </button>
            <button type="button" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Verify Email
            </button>
            <button
              type="button"
              onClick={() => setShowSuspend(true)}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Suspend
            </button>
            <button type="button" className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4 inline mr-1" /> Delete (SA Only)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-gray">All profile fields read-only. Edit (Override) to correct; changes logged with admin ID and timestamp.</p>
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <dt className="text-slate-gray">Name</dt><dd>{student.name}</dd>
                <dt className="text-slate-gray">Email</dt><dd>{student.email}</dd>
                <dt className="text-slate-gray">Mobile</dt><dd>{student.mobile || '—'}</dd>
                <dt className="text-slate-gray">University</dt><dd>{student.university || '—'}</dd>
                <dt className="text-slate-gray">Course</dt><dd>{student.course || '—'}</dd>
                <dt className="text-slate-gray">College</dt><dd>{student.collegeName || '—'}</dd>
                <dt className="text-slate-gray">Stream / Semester</dt><dd>{[student.stream, student.semester].filter(Boolean).join(' · ') || '—'}</dd>
              </dl>
            </div>
          )}
          {activeTab === 'enrolled' && (
            <div>
              {student.enrollments && student.enrollments.length > 0 ? (
                <ul className="space-y-2">
                  {student.enrollments.map((e) => (
                    <li key={e.id} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">{e.courseTitle || e.courseId} — {e.createdAt}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-gray">No enrollments.</p>
              )}
            </div>
          )}
          {activeTab === 'internships' && (
            <div>
              {student.applications && student.applications.length > 0 ? (
                <ul className="space-y-2">
                  {student.applications.map((a) => (
                    <li key={a.id} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Application — {a.status} · {a.createdAt}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-gray">No applications.</p>
              )}
            </div>
          )}
          {activeTab === 'certificates' && (
            <p className="text-sm text-slate-gray">Certificates issued to this student.</p>
          )}
          {activeTab === 'payments' && (
            <p className="text-sm text-slate-gray">Payment history.</p>
          )}
          {activeTab === 'support' && (
            <p className="text-sm text-slate-gray">Support tickets raised by student.</p>
          )}
          {activeTab === 'activity' && (
            <p className="text-sm text-slate-gray">Chronological log: login timestamps, enrollments, payments, quiz attempts, applications, certificate downloads.</p>
          )}
        </div>
      </div>

      {showSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" /> Suspend account
            </h3>
            <p className="mt-2 text-sm text-slate-gray">Student will be blocked from login. All active sessions invalidated. Reason is required.</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Reason *</label>
              <textarea rows={3} placeholder="Mandatory reason" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowSuspend(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" onClick={() => setShowSuspend(false)} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">Suspend</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
