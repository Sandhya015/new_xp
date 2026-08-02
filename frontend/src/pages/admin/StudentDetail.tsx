/**
 * Admin — Student detail (AD-WF-15 / CFRD §4).
 * Tabs: Profile, Enrolled Trainings, Applied Internships, Documents, Payments, Support Tickets, Activity Log.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  User,
  BookOpen,
  Briefcase,
  FileText,
  CreditCard,
  HelpCircle,
  Clock,
  Shield,
  Mail,
  Trash2,
} from 'lucide-react'
import {
  adminService,
  type StudentActivityRow,
  type StudentApplicationRow,
  type StudentDetail as StudentDetailType,
  type StudentDocumentRow,
  type StudentEnrollmentRow,
  type StudentPaymentRow,
  type StudentTicketRow,
} from '@/services/adminService'
import { showAppToast } from '@/components/AppToastHost'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'enrolled', label: 'Enrolled Trainings', icon: BookOpen },
  { id: 'internships', label: 'Applied Internships', icon: Briefcase },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'support', label: 'Support Tickets', icon: HelpCircle },
  { id: 'activity', label: 'Activity Log', icon: Clock },
] as const

type ModalKind = 'edit' | 'suspend' | 'delete' | 'message' | null

function errMsg(e: unknown, fallback: string) {
  const ax = e as { response?: { data?: { error?: string; message?: string } } }
  return ax?.response?.data?.error || ax?.response?.data?.message || fallback
}

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [student, setStudent] = useState<StudentDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('profile')
  const [modal, setModal] = useState<ModalKind>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [msgSubject, setMsgSubject] = useState('')
  const [msgBody, setMsgBody] = useState('')
  const [editForm, setEditForm] = useState<Record<string, string>>({})

  const [enrollments, setEnrollments] = useState<StudentEnrollmentRow[]>([])
  const [applications, setApplications] = useState<StudentApplicationRow[]>([])
  const [documents, setDocuments] = useState<StudentDocumentRow[]>([])
  const [payments, setPayments] = useState<StudentPaymentRow[]>([])
  const [tickets, setTickets] = useState<StudentTicketRow[]>([])
  const [activity, setActivity] = useState<StudentActivityRow[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!id) return
    const s = await adminService.getStudent(id)
    setStudent(s)
    setEnrollments(s.enrollments || [])
    setApplications(s.applications || [])
    setDocuments(s.documents || [])
    setPayments(s.payments || [])
    setTickets(s.tickets || [])
    setActivity(s.activityLog || [])
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    reload()
      .catch(() => setStudent(null))
      .finally(() => setLoading(false))
  }, [id, reload])

  useEffect(() => {
    if (!id || !student) return
    let cancelled = false
    const loadTab = async () => {
      setTabLoading(true)
      try {
        if (activeTab === 'enrolled') {
          const r = await adminService.getStudentEnrolledTrainings(id)
          if (!cancelled) setEnrollments(r.items || [])
        } else if (activeTab === 'internships') {
          const r = await adminService.getStudentAppliedInternships(id)
          if (!cancelled) setApplications(r.items || [])
        } else if (activeTab === 'documents') {
          const r = await adminService.getStudentDocuments(id)
          if (!cancelled) setDocuments(r.items || [])
        } else if (activeTab === 'payments') {
          const r = await adminService.getStudentPayments(id)
          if (!cancelled) setPayments(r.items || [])
        } else if (activeTab === 'support') {
          const r = await adminService.getStudentTickets(id)
          if (!cancelled) setTickets(r.items || [])
        } else if (activeTab === 'activity') {
          const r = await adminService.getStudentActivityLog(id)
          if (!cancelled) setActivity(r.items || [])
        }
      } catch {
        /* keep existing */
      } finally {
        if (!cancelled) setTabLoading(false)
      }
    }
    void loadTab()
    return () => {
      cancelled = true
    }
  }, [activeTab, id, student])

  const openEdit = () => {
    if (!student) return
    setEditForm({
      name: student.name || '',
      email: student.email || '',
      mobile: student.mobile || '',
      university: student.university || '',
      collegeName: student.collegeName || '',
      course: student.course || '',
      branch: student.branch || student.stream || '',
      semester: student.semester || '',
      dateOfBirth: student.dateOfBirth || '',
      addressLine1: student.addressLine1 || '',
      addressApartment: student.addressApartment || '',
      addressCity: student.addressCity || '',
      addressState: student.addressState || '',
      addressPincode: student.addressPincode || '',
      addressCountry: student.addressCountry || '',
    })
    setModal('edit')
  }

  const runAction = async (fn: () => Promise<unknown>, success: string, opts?: { skipReload?: boolean }) => {
    if (!id) return
    setBusy(true)
    try {
      await fn()
      showAppToast(success)
      setModal(null)
      if (!opts?.skipReload) await reload()
    } catch (e) {
      showAppToast(errMsg(e, 'Action failed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-gray">Loading student…</div>
  if (!student) return <div className="p-6 text-red-600">Student not found.</div>

  const isSuspended = (student.accountStatus || '').toLowerCase() === 'suspended' || student.status === 'Suspended'
  const isDeleted = (student.accountStatus || '').toLowerCase() === 'deleted' || student.status === 'Deleted'

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
              <p className="text-sm text-slate-gray">
                {student.email}
                {student.emailVerified ? (
                  <span className="ml-2 text-xs text-emerald-700">Verified</span>
                ) : (
                  <span className="ml-2 text-xs text-amber-700">Unverified</span>
                )}
                <span className="ml-2 text-xs text-slate-gray">· {student.status}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || isDeleted}
              onClick={openEdit}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Edit (Override)
            </button>
            <button
              type="button"
              disabled={busy || isDeleted}
              onClick={() =>
                runAction(() => adminService.resetStudentPassword(id!), 'Password reset email sent')
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Reset Password
            </button>
            <button
              type="button"
              disabled={busy || isDeleted}
              onClick={() => {
                setMsgSubject('')
                setMsgBody('')
                setModal('message')
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Mail className="h-4 w-4 inline mr-1" /> Send Message
            </button>
            <button
              type="button"
              disabled={busy || isDeleted || student.emailVerified}
              onClick={() => runAction(() => adminService.verifyStudentEmail(id!), 'Email verified')}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Verify Email
            </button>
            {isSuspended ? (
              <button
                type="button"
                disabled={busy || isDeleted}
                onClick={() => runAction(() => adminService.unsuspendStudent(id!), 'Account reactivated')}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Unsuspend
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || isDeleted}
                onClick={() => {
                  setSuspendReason('')
                  setModal('suspend')
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Suspend
              </button>
            )}
            {!isDeleted && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirmEmail('')
                  setModal('delete')
                }}
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 inline mr-1" /> Delete (SA Only)
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-slate-gray hover:text-brand-navy'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tabLoading && activeTab !== 'profile' && (
            <p className="mb-3 text-sm text-slate-gray">Loading…</p>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-gray">
                Profile fields are read-only here. Use Edit (Override) to correct; each change is logged.
              </p>
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <dt className="text-slate-gray">Name</dt>
                <dd>{student.name || '—'}</dd>
                <dt className="text-slate-gray">Email</dt>
                <dd>{student.email || '—'}</dd>
                <dt className="text-slate-gray">Mobile</dt>
                <dd>{student.mobile || '—'}</dd>
                <dt className="text-slate-gray">Date of birth</dt>
                <dd>{student.dateOfBirth || '—'}</dd>
                <dt className="text-slate-gray">University</dt>
                <dd>{student.university || '—'}</dd>
                <dt className="text-slate-gray">College</dt>
                <dd>{student.collegeName || '—'}</dd>
                <dt className="text-slate-gray">Course</dt>
                <dd>{student.course || '—'}</dd>
                <dt className="text-slate-gray">Branch / Stream</dt>
                <dd>{student.branch || student.stream || '—'}</dd>
                <dt className="text-slate-gray">Semester</dt>
                <dd>{student.semester || '—'}</dd>
                <dt className="text-slate-gray">Address</dt>
                <dd>
                  {[
                    student.addressLine1,
                    student.addressApartment,
                    student.addressCity,
                    student.addressState,
                    student.addressPincode,
                    student.addressCountry,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </dd>
                <dt className="text-slate-gray">Registered</dt>
                <dd>{student.registered || '—'}</dd>
              </dl>
            </div>
          )}

          {activeTab === 'enrolled' && (
            <div>
              {enrollments.length === 0 ? (
                <p className="text-sm text-slate-gray">No enrollments.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
                      <tr>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">University</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Mode</th>
                        <th className="px-3 py-2">Duration</th>
                        <th className="px-3 py-2">Fee</th>
                        <th className="px-3 py-2">Enrolled</th>
                        <th className="px-3 py-2">Progress</th>
                        <th className="px-3 py-2">Certificate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {enrollments.map((e) => (
                        <tr key={e.id}>
                          <td className="px-3 py-2 font-medium text-brand-navy">
                            {e.title || e.courseTitle || e.courseId}
                          </td>
                          <td className="px-3 py-2 text-slate-gray">{e.university || '—'}</td>
                          <td className="px-3 py-2 text-slate-gray">{e.category || '—'}</td>
                          <td className="px-3 py-2 text-slate-gray">{e.mode || '—'}</td>
                          <td className="px-3 py-2 text-slate-gray">{e.duration || '—'}</td>
                          <td className="px-3 py-2 text-slate-gray">{e.feePaid ? 'Paid' : '—'}</td>
                          <td className="px-3 py-2 text-slate-gray">
                            {e.enrollmentDate || e.createdAt || '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-gray">
                            {e.progressPercent != null ? `${e.progressPercent}%` : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-gray">{e.certificateStatus || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'internships' && (
            <div>
              {applications.length === 0 ? (
                <p className="text-sm text-slate-gray">No applications.</p>
              ) : (
                <ul className="space-y-2">
                  {applications.map((a) => (
                    <li key={a.id} className="rounded-lg border border-gray-200 px-4 py-3 text-sm">
                      <div className="font-medium text-brand-navy">
                        {a.role || 'Internship'} · {a.company || '—'}
                      </div>
                      <div className="mt-1 text-slate-gray">
                        {a.status}
                        {a.appliedAt || a.createdAt ? ` · Applied ${a.appliedAt || a.createdAt}` : ''}
                        {a.startDate || a.endDate
                          ? ` · ${a.startDate || '?'} → ${a.endDate || '?'}`
                          : ''}
                      </div>
                      {a.offerLetter && (
                        <a
                          href={a.offerLetter}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-brand-accent hover:underline"
                        >
                          Offer letter
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              {documents.length === 0 ? (
                <p className="text-sm text-slate-gray">No certificates or offer letters.</p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <li key={d.id} className="rounded-lg border border-gray-200 px-4 py-3 text-sm flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="font-medium text-brand-navy">{d.title}</span>
                        <span className="ml-2 text-xs uppercase text-slate-gray">{d.type}</span>
                        {d.certNo && <span className="ml-2 text-slate-gray">{d.certNo}</span>}
                        <div className="text-slate-gray">
                          {d.status || ''}
                          {d.issuedAt ? ` · ${d.issuedAt}` : ''}
                        </div>
                      </div>
                      {d.url && (
                        <a href={d.url} target="_blank" rel="noreferrer" className="text-brand-accent hover:underline">
                          Open
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              {payments.length === 0 ? (
                <p className="text-sm text-slate-gray">No payments.</p>
              ) : (
                <ul className="space-y-2">
                  {payments.map((p) => (
                    <li key={p.id} className="rounded-lg border border-gray-200 px-4 py-2 text-sm flex flex-wrap justify-between gap-2">
                      <span>
                        <Link to={`/admin/payments/${p.id}`} className="font-medium text-brand-accent hover:underline">
                          {p.orderId || p.id}
                        </Link>
                        <span className="ml-2 text-slate-gray">₹{p.amount}</span>
                        <span className="ml-2 text-slate-gray">{p.status}</span>
                      </span>
                      <span className="text-slate-gray">{p.createdAt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'support' && (
            <div>
              {tickets.length === 0 ? (
                <p className="text-sm text-slate-gray">No support tickets.</p>
              ) : (
                <ul className="space-y-2">
                  {tickets.map((t) => (
                    <li key={t.id} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
                      <span className="font-medium text-brand-navy">{t.ticketId}</span>
                      <span className="ml-2">{t.subject}</span>
                      <span className="ml-2 text-slate-gray">
                        {t.status} · {t.createdAt}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              {activity.length === 0 ? (
                <p className="text-sm text-slate-gray">No activity logged yet.</p>
              ) : (
                <ul className="space-y-2">
                  {activity.map((a) => (
                    <li key={a.id} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
                      <div className="font-medium text-brand-navy">{a.action}</div>
                      <div className="text-slate-gray">
                        {a.actorName || a.actorEmail || 'system'} · {a.createdAt}
                      </div>
                      {(a.oldValue != null || a.newValue != null) && (
                        <pre className="mt-1 overflow-x-auto text-xs text-slate-gray whitespace-pre-wrap">
                          {JSON.stringify({ old: a.oldValue, new: a.newValue }, null, 0)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {modal === 'suspend' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" /> Suspend account
            </h3>
            <p className="mt-2 text-sm text-slate-gray">
              Student will be blocked from login. Reason is recommended.
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Reason</label>
              <textarea
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(
                    () => adminService.suspendStudent(id!, suspendReason.trim()),
                    'Student suspended',
                  )
                }
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" /> Soft-delete student
            </h3>
            <p className="mt-2 text-sm text-slate-gray">
              Type the student email to confirm: <strong>{student.email}</strong>
            </p>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="confirmEmail"
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || confirmEmail.trim().toLowerCase() !== student.email.toLowerCase()}
                onClick={() =>
                  runAction(
                    async () => {
                      await adminService.deleteStudent(id!, confirmEmail.trim())
                      navigate('/admin/students')
                    },
                    'Student deleted',
                    { skipReload: true },
                  )
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'message' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy flex items-center gap-2">
              <Mail className="h-5 w-5" /> Send message
            </h3>
            <p className="mt-1 text-sm text-slate-gray">Emails the student and opens a support ticket.</p>
            <input
              type="text"
              value={msgSubject}
              onChange={(e) => setMsgSubject(e.target.value)}
              placeholder="Subject"
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              rows={5}
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              placeholder="Message body (text or HTML)"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !msgSubject.trim() || !msgBody.trim()}
                onClick={() =>
                  runAction(
                    () =>
                      adminService.messageStudent(id!, {
                        subject: msgSubject.trim(),
                        body: msgBody.trim(),
                      }),
                    'Message sent',
                  )
                }
                className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Edit student (override)</h3>
            <p className="mt-1 text-sm text-slate-gray">Each changed field is written to the activity log.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['name', 'Name'],
                  ['email', 'Email'],
                  ['mobile', 'Mobile'],
                  ['dateOfBirth', 'Date of birth'],
                  ['university', 'University'],
                  ['collegeName', 'College'],
                  ['course', 'Course'],
                  ['branch', 'Branch'],
                  ['semester', 'Semester'],
                  ['addressLine1', 'Address line 1'],
                  ['addressApartment', 'Apartment'],
                  ['addressCity', 'City'],
                  ['addressState', 'State'],
                  ['addressPincode', 'Pincode'],
                  ['addressCountry', 'Country'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="font-medium text-gray-700">{label}</span>
                  <input
                    type={key === 'dateOfBirth' ? 'date' : key === 'email' ? 'email' : 'text'}
                    value={editForm[key] || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(() => adminService.updateStudent(id!, editForm), 'Student updated')
                }
                className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
