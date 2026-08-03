/**
 * Admin — Student detail (AD-WF-15 / CFRD §4 + Rev 2 S3/S4/S5).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Eye,
  EyeOff,
  RefreshCw,
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
import { RichTextEditor, type RichTextEditorHandle } from '@/components/admin/RichTextEditor'
import { SearchableSingleSelect } from '@/components/admin/SearchableSelect'
import {
  useAcademicMasters,
  collegeOptionsForUniversities,
  branchSubjectOptions,
  semesterLabelsForCourse,
  isBranchCourse,
} from '@/hooks/useAcademicMasters'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'enrolled', label: 'Enrolled Trainings', icon: BookOpen },
  { id: 'internships', label: 'Applied Internships', icon: Briefcase },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'support', label: 'Support Tickets', icon: HelpCircle },
  { id: 'activity', label: 'Activity Log', icon: Clock },
] as const

type ModalKind = 'edit' | 'suspend' | 'delete' | 'message' | 'password' | null

function errMsg(e: unknown, fallback: string) {
  const ax = e as { response?: { data?: { error?: string; message?: string } } }
  return ax?.response?.data?.error || ax?.response?.data?.message || fallback
}

function genPassword(len = 12): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '23456789'
  const all = letters + digits
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  let out = ''
  // ensure letter + digit
  out += letters[arr[0] % letters.length]
  out += digits[arr[1] % digits.length]
  for (let i = 2; i < len; i++) out += all[arr[i] % all.length]
  return out
}

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { universities, courses, states } = useAcademicMasters()
  const msgEditorRef = useRef<RichTextEditorHandle>(null)

  const [student, setStudent] = useState<StudentDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('profile')
  const [modal, setModal] = useState<ModalKind>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [msgSubject, setMsgSubject] = useState('')
  const [msgBody, setMsgBody] = useState('')
  const [msgFiles, setMsgFiles] = useState<File[]>([])
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [pwForm, setPwForm] = useState({
    newPassword: '',
    confirmPassword: '',
    notifyStudent: true,
    forceChangeOnLogin: true,
    reason: '',
  })
  const [showPw, setShowPw] = useState(false)

  const [enrollments, setEnrollments] = useState<StudentEnrollmentRow[]>([])
  const [applications, setApplications] = useState<StudentApplicationRow[]>([])
  const [documents, setDocuments] = useState<StudentDocumentRow[]>([])
  const [payments, setPayments] = useState<StudentPaymentRow[]>([])
  const [tickets, setTickets] = useState<StudentTicketRow[]>([])
  const [activity, setActivity] = useState<StudentActivityRow[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  const collegeOpts = useMemo(
    () => collegeOptionsForUniversities(editForm.university ? [editForm.university] : []).map((c) => ({ value: c, label: c })),
    [editForm.university],
  )
  const branchOpts = useMemo(
    () => branchSubjectOptions(editForm.course || ''),
    [editForm.course],
  )
  const semesterOpts = useMemo(
    () => semesterLabelsForCourse(editForm.course || '').map((s) => ({ value: s, label: s })),
    [editForm.course],
  )
  const branchLabel = editForm.course
    ? isBranchCourse(editForm.course)
      ? 'Branch'
      : 'Subject'
    : 'Branch / Subject'

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

  const openPassword = () => {
    const g = genPassword()
    setPwForm({
      newPassword: g,
      confirmPassword: g,
      notifyStudent: true,
      forceChangeOnLogin: true,
      reason: '',
    })
    setShowPw(true)
    setModal('password')
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
              onClick={openPassword}
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
                setMsgFiles([])
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
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {enrollments.map((e) => (
                        <tr key={e.id}>
                          <td className="px-3 py-2">{e.title || e.courseTitle || e.courseId}</td>
                          <td className="px-3 py-2">{e.enrollmentDate || e.createdAt || '—'}</td>
                          <td className="px-3 py-2">{e.status || '—'}</td>
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
                    <li key={a.id} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
                      <div className="font-medium">{a.company || '—'} — {a.role || a.internshipId}</div>
                      <div className="text-slate-gray">{a.status} · {a.appliedAt || a.createdAt || ''}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              {documents.length === 0 ? (
                <p className="text-sm text-slate-gray">No documents.</p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <li key={d.id} className="rounded-lg border border-gray-200 px-4 py-2 text-sm flex justify-between">
                      <span>
                        {d.title || d.type} {d.certNo ? `(${d.certNo})` : ''}
                      </span>
                      <span className="text-slate-gray">{d.status || d.issuedAt || ''}</span>
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
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
                      <tr>
                        <th className="px-3 py-2">Order</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2">
                            <Link className="text-brand-accent hover:underline" to={`/admin/payments/${p.id}`}>
                              {p.orderId || p.id}
                            </Link>
                          </td>
                          <td className="px-3 py-2">₹{Number(p.amount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2">{p.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'support' && (
            <div>
              {tickets.length === 0 ? (
                <p className="text-sm text-slate-gray">No tickets.</p>
              ) : (
                <ul className="space-y-2">
                  {tickets.map((t) => (
                    <li key={t.id} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
                      <div className="font-medium">{t.subject || t.id}</div>
                      <div className="text-slate-gray">{t.status}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              {activity.length === 0 ? (
                <p className="text-sm text-slate-gray">No activity yet.</p>
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
            <p className="mt-2 text-sm text-slate-gray">Student will be blocked from login. Reason is recommended.</p>
            <textarea
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension"
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction(() => adminService.suspendStudent(id!, suspendReason.trim()), 'Student suspended')}
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
            <h3 className="font-semibold text-red-700 flex items-center gap-2">
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
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
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

      {modal === 'password' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy">Set new password (SA)</h3>
            <p className="mt-1 text-sm text-slate-gray">
              Direct set — hashed with pbkdf2. Max 3 resets/day. Sessions are invalidated.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="font-medium text-gray-700">New password</span>
                <div className="mt-1 flex gap-2">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.newPassword}
                    onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  />
                  <button type="button" className="rounded border px-2" onClick={() => setShowPw((s) => !s)} title="Show/hide">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    className="rounded border px-2"
                    title="Generate"
                    onClick={() => {
                      const g = genPassword()
                      setPwForm((f) => ({ ...f, newPassword: g, confirmPassword: g }))
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Confirm password</span>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pwForm.notifyStudent}
                  onChange={(e) => setPwForm((f) => ({ ...f, notifyStudent: e.target.checked }))}
                />
                Notify student by email (password not included)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pwForm.forceChangeOnLogin}
                  onChange={(e) => setPwForm((f) => ({ ...f, forceChangeOnLogin: e.target.checked }))}
                />
                Force password change on next login
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Reason (optional)</span>
                <input
                  value={pwForm.reason}
                  onChange={(e) => setPwForm((f) => ({ ...f, reason: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !pwForm.newPassword || pwForm.newPassword !== pwForm.confirmPassword}
                onClick={() =>
                  runAction(
                    () =>
                      adminService.setStudentPassword(id!, {
                        newPassword: pwForm.newPassword,
                        confirmPassword: pwForm.confirmPassword,
                        notifyStudent: pwForm.notifyStudent,
                        forceChangeOnLogin: pwForm.forceChangeOnLogin,
                        reason: pwForm.reason || undefined,
                      }),
                    'Password updated',
                  )
                }
                className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Set password
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'message' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-brand-navy flex items-center gap-2">
              <Mail className="h-5 w-5" /> Send message
            </h3>
            <p className="mt-1 text-sm text-slate-gray">
              Emails the student (BCC support@), creates a support ticket. Max 5 attachments (10 MB each, 25 MB total).
            </p>
            <input
              type="text"
              value={msgSubject}
              onChange={(e) => setMsgSubject(e.target.value)}
              placeholder="Subject"
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-3">
              <RichTextEditor
                ref={msgEditorRef}
                label="Message"
                value={msgBody}
                onChange={setMsgBody}
                placeholder="Write your message…"
                minHeightClass="min-h-[160px]"
              />
            </div>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-gray-700">Attachments (optional)</span>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
                className="mt-1 block w-full text-sm"
                onChange={(e) => {
                  const list = Array.from(e.target.files || []).slice(0, 5)
                  setMsgFiles(list)
                }}
              />
              {msgFiles.length > 0 && (
                <ul className="mt-1 text-xs text-slate-gray">
                  {msgFiles.map((f) => (
                    <li key={f.name}>
                      {f.name} ({Math.round(f.size / 1024)} KB)
                    </li>
                  ))}
                </ul>
              )}
            </label>
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !msgSubject.trim()}
                onClick={() => {
                  const html = msgEditorRef.current?.getHtml() || msgBody
                  if (!html.trim() || html === '<p></p>') {
                    showAppToast('Message body is required', 'error')
                    return
                  }
                  void runAction(
                    () =>
                      adminService.messageStudent(id!, {
                        subject: msgSubject.trim(),
                        body: html,
                        files: msgFiles,
                      }),
                    'Message sent',
                  )
                }}
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
            <p className="mt-1 text-sm text-slate-gray">Registration masters for academic fields. Dependent fields reset when parent changes.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Name</span>
                <input
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Email</span>
                <input
                  type="email"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Mobile</span>
                <input
                  value={editForm.mobile || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Date of birth</span>
                <input
                  type="date"
                  value={editForm.dateOfBirth || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <SearchableSingleSelect
                label="University"
                options={universities.map((u) => ({ value: u.value, label: u.label }))}
                value={editForm.university || ''}
                onChange={(v) => setEditForm((f) => ({ ...f, university: v, collegeName: '' }))}
              />
              <SearchableSingleSelect
                label="College"
                options={collegeOpts}
                value={editForm.collegeName || ''}
                onChange={(v) => setEditForm((f) => ({ ...f, collegeName: v }))}
                disabled={!editForm.university}
              />
              <SearchableSingleSelect
                label="Course"
                options={courses.map((c) => ({ value: c, label: c }))}
                value={editForm.course || ''}
                onChange={(v) => setEditForm((f) => ({ ...f, course: v, branch: '', semester: '' }))}
              />
              <SearchableSingleSelect
                label={branchLabel}
                options={branchOpts}
                value={editForm.branch || ''}
                onChange={(v) => setEditForm((f) => ({ ...f, branch: v }))}
                disabled={!editForm.course}
              />
              <SearchableSingleSelect
                label="Semester"
                options={semesterOpts}
                value={editForm.semester || ''}
                onChange={(v) => setEditForm((f) => ({ ...f, semester: v }))}
                disabled={!editForm.course}
              />
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Address line 1</span>
                <input
                  value={editForm.addressLine1 || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, addressLine1: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Apartment</span>
                <input
                  value={editForm.addressApartment || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, addressApartment: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">City</span>
                <input
                  value={editForm.addressCity || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, addressCity: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <SearchableSingleSelect
                label="State"
                options={states.map((s) => ({ value: s, label: s }))}
                value={editForm.addressState || ''}
                onChange={(v) => setEditForm((f) => ({ ...f, addressState: v }))}
              />
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Pincode</span>
                <input
                  value={editForm.addressPincode || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, addressPincode: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Country</span>
                <input
                  value={editForm.addressCountry || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, addressCountry: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction(() => adminService.updateStudent(id!, editForm), 'Student updated')}
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
