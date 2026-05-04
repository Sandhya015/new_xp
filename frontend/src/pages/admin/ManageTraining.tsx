/**
 * Admin — Manage Existing Training (AD-WF-04). Tabs: Overview, Class Links, Materials, Assignments, Quizzes, Attendance, Announcements, Enrolled Students.
 */
import { useEffect, useRef, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Link2,
  FileText,
  ClipboardList,
  HelpCircle,
  UserCheck,
  Users,
  Download,
  Send,
  Star,
  Trash2,
  Pencil,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { adminService } from '@/services/adminService'
import { courseListingBlurb } from '@/utils/sanitizeHtml'
import { REGISTRATION_UNIVERSITIES_LIST } from '@/constants/registrationUniversities'
import { REGISTRATION_COLLEGES_BY_UNIVERSITY, collegeOptionsFromList } from '@/constants/registrationColleges'
import { OTHER_OPTION_VALUE, STUDENT_COURSES, BRANCHES_66 } from '@/constants/registrationLists'
import { QuizBuilderModal, type QuizSettingsDraft } from '@/components/admin/QuizBuilderModal'
import { CourseCouponsEditor, couponsFromApiList, couponsToApiList, type EnrollmentCouponFormRow } from '@/components/admin/CourseCouponsEditor'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'class-links', label: 'Class Links', icon: Link2 },
  { id: 'materials', label: 'Study Materials', icon: FileText },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
  { id: 'quizzes', label: 'Quizzes', icon: HelpCircle },
  { id: 'attendance', label: 'Attendance', icon: UserCheck },
  { id: 'announcements', label: 'Announcements', icon: Send },
  { id: 'enrolled', label: 'Enrolled Students', icon: Users },
  { id: 'reviews', label: 'Reviews', icon: Star },
] as const

type CourseDetail = {
  id: string
  title: string
  description: string
  shortDescription?: string
  fullDescription?: string
  category?: string
  duration?: string
  durationValue?: string
  durationUnit?: string
  mode?: string
  universities?: string
  price?: number
  tag?: string
  active?: boolean
  trainerName?: string
  courses?: string[]
  streams?: string[]
  batches?: Array<{ name: string; startDate: string; endDate: string; maxSeats: string; mode: string }>
  curriculum?: unknown[]
  classLinks?: Array<{ id?: string; title: string; date: string; time: string; platform: string; link: string; batch: string }>
  studyMaterials?: Array<{ id?: string; title: string; module: string; type: string; url: string }>
  assignments?: Array<{ id?: string; title: string; dueDate: string; description: string; published?: boolean }>
  quizzes?: Array<{
    id?: string
    title: string
    dueDate: string
    published?: boolean
    details?: string
    quizQuestions?: unknown[]
    quizSettings?: Partial<QuizSettingsDraft>
  }>
  announcements?: Array<{ id?: string; title: string; message: string; createdAt?: string }>
  trainingKit?: {
    enabled?: boolean
    name?: string
    shortDescription?: string
    thumbnailUrl?: string
    priceInr?: number
    stock?: number | null
  }
  enrollmentCoupons?: Array<Record<string, unknown>>
}

type EnrollmentRow = {
  id: string
  name: string
  email: string
  mobile: string
  university: string
  collegeName: string
  course: string
  stream: string
  branch?: string
  semester: string
  registrationNumber?: string
  enrolledAt: string
  submissionsCount?: number
  batch: string
  orderId?: string
  assignmentSubmissions?: Array<{
    assignmentId: string
    assignmentTitle?: string
    text?: string
    fileUrl?: string
    originalFileName?: string
    mimeType?: string
    fileStorageName?: string
    submittedAt?: string
  }>
}

const defaultEnrollFilters = () => ({
  university: '',
  college: '',
  course: '',
  branch: '',
  dateFrom: '',
  dateTo: '',
  search: '',
})

function enrollFiltersToQuery(f: ReturnType<typeof defaultEnrollFilters>): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  if (f.university.trim()) out.university = f.university.trim()
  if (f.college.trim()) out.college = f.college.trim()
  if (f.course.trim()) out.course = f.course.trim()
  if (f.branch.trim()) out.branch = f.branch.trim()
  if (f.dateFrom.trim()) out.dateFrom = f.dateFrom.trim()
  if (f.dateTo.trim()) out.dateTo = f.dateTo.trim()
  if (f.search.trim()) out.search = f.search.trim()
  return Object.keys(out).length ? out : undefined
}

export function ManageTraining() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('overview')
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [submissionViewer, setSubmissionViewer] = useState<EnrollmentRow | null>(null)
  const [submissionDownloadError, setSubmissionDownloadError] = useState<string | null>(null)
  const [adminReviews, setAdminReviews] = useState<
    Array<{
      id: string
      studentName: string
      rating: number
      title: string
      body: string
      flagged: boolean
      deleted: boolean
      createdAt: string
    }>
  >([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [kitForm, setKitForm] = useState({
    enabled: false,
    name: '',
    shortDescription: '',
    thumbnailUrl: '',
    priceInr: '',
  })
  const [couponRows, setCouponRows] = useState<EnrollmentCouponFormRow[]>([])
  const [couponUsage, setCouponUsage] = useState<Record<string, { used: number; maxUses: number | null }>>({})
  const [quizAttemptRows, setQuizAttemptRows] = useState<
    Array<{
      enrollmentId: string
      userId: string
      studentName: string
      email: string
      attempts: Array<{
        quizTitle: string
        passed: boolean
        scorePercent?: number
        attempts?: number
        updatedAt?: string
      }>
    }>
  >([])
  const [quizAttemptsLoading, setQuizAttemptsLoading] = useState(false)
  const [commerceMsg, setCommerceMsg] = useState<string | null>(null)
  const [enrollFilterDraft, setEnrollFilterDraft] = useState(defaultEnrollFilters)
  const [enrollFiltersApplied, setEnrollFiltersApplied] = useState(defaultEnrollFilters)
  const [enrollExportBusy, setEnrollExportBusy] = useState(false)
  const enrollCollegeOptions = useMemo(() => {
    const u = enrollFilterDraft.university.trim()
    if (!u || u === OTHER_OPTION_VALUE) return []
    const raw = REGISTRATION_COLLEGES_BY_UNIVERSITY[u]
    if (!raw || !Array.isArray(raw)) return []
    return collegeOptionsFromList(raw)
  }, [enrollFilterDraft.university])
  const [attData, setAttData] = useState<{
    sessions: Array<{
      sessionKey: string
      title: string
      sessionDate: string
      time: string
      platform: string
      canMark: boolean
      records: Record<string, { status: string; note: string }>
      updatedAt: string
    }>
    students: Array<{ userId: string; name: string; email: string }>
  } | null>(null)
  const [attLoading, setAttLoading] = useState(false)
  const [attSession, setAttSession] = useState('')
  const [attStatusByUser, setAttStatusByUser] = useState<Record<string, string>>({})
  const [attNoteByUser, setAttNoteByUser] = useState<Record<string, string>>({})
  const [attSaving, setAttSaving] = useState(false)
  const [attMsg, setAttMsg] = useState<string | null>(null)
  const [quizEditorIdx, setQuizEditorIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    adminService.getCourse(id).then(setCourse).catch(() => setCourse(null)).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (id && activeTab === 'enrolled') {
      setEnrollLoading(true)
      adminService
        .getCourseEnrollments(id, enrollFiltersToQuery(enrollFiltersApplied))
        .then((r) => setEnrollments(r.items || []))
        .catch(() => setEnrollments([]))
        .finally(() => setEnrollLoading(false))
    }
  }, [id, activeTab, enrollFiltersApplied])

  useEffect(() => {
    if (!id || activeTab !== 'attendance') return
    setAttLoading(true)
    setAttMsg(null)
    adminService
      .getCourseAttendance(id)
      .then((d) => {
        setAttData(d)
        const first = d.sessions.find((s) => s.canMark)
        setAttSession((prev) => (prev && d.sessions.some((s) => s.sessionKey === prev) ? prev : (first?.sessionKey ?? d.sessions[0]?.sessionKey ?? '')))
      })
      .catch(() => {
        setAttData(null)
        setAttSession('')
      })
      .finally(() => setAttLoading(false))
  }, [id, activeTab])

  useEffect(() => {
    if (!attSession || !attData) return
    const s = attData.sessions.find((x) => x.sessionKey === attSession)
    if (!s) return
    const st: Record<string, string> = {}
    const nt: Record<string, string> = {}
    for (const u of attData.students) {
      const r = s.records[u.userId]
      st[u.userId] = r?.status ?? 'present'
      nt[u.userId] = r?.note ?? ''
    }
    setAttStatusByUser(st)
    setAttNoteByUser(nt)
  }, [attSession, attData])

  useEffect(() => {
    if (!id || activeTab !== 'overview') return
    adminService
      .getCourseCouponRedemptions(id)
      .then((d) => {
        const m: Record<string, { used: number; maxUses: number | null }> = {}
        for (const x of d.items || []) {
          m[String(x.code || '').toUpperCase()] = { used: x.used, maxUses: x.maxUses ?? null }
        }
        setCouponUsage(m)
      })
      .catch(() => setCouponUsage({}))
  }, [id, activeTab])

  useEffect(() => {
    if (!id || activeTab !== 'quizzes') return
    setQuizAttemptsLoading(true)
    adminService
      .getCourseCurriculumQuizAttempts(id)
      .then((r) => setQuizAttemptRows(r.items || []))
      .catch(() => setQuizAttemptRows([]))
      .finally(() => setQuizAttemptsLoading(false))
  }, [id, activeTab])

  useEffect(() => {
    if (id && activeTab === 'reviews') {
      setReviewsLoading(true)
      adminService
        .getCourseReviews(id)
        .then((r) => setAdminReviews(r.items || []))
        .catch(() => setAdminReviews([]))
        .finally(() => setReviewsLoading(false))
    }
  }, [id, activeTab])

  useEffect(() => {
    if (!course) return
    const tk = course.trainingKit || {}
    setKitForm({
      enabled: Boolean(tk.enabled),
      name: String(tk.name || ''),
      shortDescription: String(tk.shortDescription || ''),
      thumbnailUrl: String(tk.thumbnailUrl || ''),
      priceInr: tk.priceInr != null && Number.isFinite(Number(tk.priceInr)) ? String(tk.priceInr) : '',
    })
    const ec = course.enrollmentCoupons
    setCouponRows(couponsFromApiList(Array.isArray(ec) ? ec : []))
  }, [course])

  const saveCommerce = async () => {
    if (!id || !course) return
    const couponsParsed = couponsToApiList(couponRows)
    if (couponRows.some((r) => (r.code || '').trim()) && couponsParsed.length === 0) {
      setCommerceMsg('Check each coupon: code and discount value are required.')
      return
    }
    setCommerceMsg(null)
    setSaving(true)
    setError(null)
    try {
      const price = parseFloat(kitForm.priceInr) || 0
      const trainingKit = {
        enabled: kitForm.enabled && price > 0,
        name: kitForm.name.trim(),
        shortDescription: kitForm.shortDescription.trim(),
        thumbnailUrl: kitForm.thumbnailUrl.trim(),
        priceInr: kitForm.enabled ? price : 0,
      }
      const updated = await adminService.updateCourse(id, {
        trainingKit,
        enrollmentCoupons: couponsParsed as CourseDetail['enrollmentCoupons'],
      })
      setCourse(updated)
      setCommerceMsg('Saved kit & coupons.')
      adminService
        .getCourseCouponRedemptions(id)
        .then((d) => {
          const m: Record<string, { used: number; maxUses: number | null }> = {}
          for (const x of d.items || []) {
            m[String(x.code || '').toUpperCase()] = { used: x.used, maxUses: x.maxUses ?? null }
          }
          setCouponUsage(m)
        })
        .catch(() => {})
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response
        ? String((e.response as { data?: { error?: string } }).data?.error ?? 'Update failed')
        : 'Update failed'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const updateCourseSection = async (section: keyof CourseDetail, value: unknown) => {
    if (!id || !course) return
    setSaving(true)
    setError(null)
    try {
      const updated = await adminService.updateCourse(id, { [section]: value })
      setCourse(updated)
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response
        ? String((e.response as { data?: { error?: string } }).data?.error ?? 'Update failed')
        : 'Update failed'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const addClassLink = (link: { title: string; date: string; time: string; platform: string; link: string; batch: string }) => {
    const classLinks = [...(course?.classLinks || []), { ...link, batch: link.batch || '', id: `cl_${Date.now()}` }]
    updateCourseSection('classLinks', classLinks)
  }
  const removeClassLink = (index: number) => {
    const classLinks = (course?.classLinks || []).filter((_, i) => i !== index)
    updateCourseSection('classLinks', classLinks)
  }

  const addMaterial = (m: { title: string; module: string; type: string; url: string }) => {
    const studyMaterials = [...(course?.studyMaterials || []), { ...m, id: `sm_${Date.now()}` }]
    updateCourseSection('studyMaterials', studyMaterials)
  }
  const removeMaterial = (index: number) => {
    const studyMaterials = (course?.studyMaterials || []).filter((_, i) => i !== index)
    updateCourseSection('studyMaterials', studyMaterials)
  }

  const addAssignment = (a: { title: string; dueDate: string; description: string }) => {
    const assignments = [...(course?.assignments || []), { ...a, id: `a_${Date.now()}`, published: true }]
    updateCourseSection('assignments', assignments)
  }
  const updateAssignment = (
    index: number,
    patch: Partial<{ title: string; dueDate: string; description: string; published: boolean }>,
  ) => {
    const assignments = (course?.assignments || []).map((item, i) => (i === index ? { ...item, ...patch } : item))
    updateCourseSection('assignments', assignments)
  }
  const removeAssignment = (index: number) => {
    const assignments = (course?.assignments || []).filter((_, i) => i !== index)
    updateCourseSection('assignments', assignments)
  }

  const addQuiz = (q: { title: string; dueDate: string }) => {
    const quizzes = [
      ...(course?.quizzes || []),
      { ...q, id: `q_${Date.now()}`, published: true, details: '', quizQuestions: [] },
    ]
    updateCourseSection('quizzes', quizzes)
  }
  const removeQuiz = (index: number) => {
    setQuizEditorIdx((prev) => {
      if (prev === null) return null
      if (prev === index) return null
      if (prev > index) return prev - 1
      return prev
    })
    const quizzes = (course?.quizzes || []).filter((_, i) => i !== index)
    updateCourseSection('quizzes', quizzes)
  }
  const updateQuiz = (index: number, patch: Partial<NonNullable<CourseDetail['quizzes']>[number]>) => {
    const quizzes = (course?.quizzes || []).map((item, i) => (i === index ? { ...item, ...patch } : item))
    updateCourseSection('quizzes', quizzes)
  }

  const addAnnouncement = (a: { title: string; message: string }) => {
    const announcements = [...(course?.announcements || []), { ...a, id: `an_${Date.now()}`, createdAt: new Date().toISOString() }]
    updateCourseSection('announcements', announcements)
  }
  const removeAnnouncement = (index: number) => {
    const announcements = (course?.announcements || []).filter((_, i) => i !== index)
    updateCourseSection('announcements', announcements)
  }

  if (loading) return <div className="p-6 text-slate-gray">Loading training…</div>
  if (!course) return <div className="p-6 text-red-600">Training not found.</div>

  const overviewDescriptionBlurb = courseListingBlurb(course.shortDescription, course.description)

  const downloadSubmissionAdmin = async (fileStorageName: string, originalName: string) => {
    setSubmissionDownloadError(null)
    try {
      const blob = await adminService.downloadAssignmentSubmissionFile(fileStorageName)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = originalName?.trim() || 'submission'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setSubmissionDownloadError('Could not download file.')
    }
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Link to="/admin/courses" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-brand-navy truncate">{course.title || 'Manage Training'}</h2>
          <p className="text-sm text-slate-gray">Edit content, class links, materials, quizzes, attendance, and announcements.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.id ? 'border-brand-accent text-brand-accent bg-white' : 'border-transparent text-slate-gray hover:text-brand-navy hover:bg-gray-50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Link
                to={`/admin/courses/${id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-4 w-4" /> Edit Training Details
              </Link>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <dt className="text-slate-500">Title</dt><dd className="font-medium">{course.title}</dd>
              <dt className="text-slate-500">Category</dt><dd>{course.category || '—'}</dd>
              <dt className="text-slate-500">Duration</dt><dd>{course.duration || course.durationValue ? `${course.durationValue || ''} ${course.durationUnit || ''}` : '—'}</dd>
              <dt className="text-slate-500">Mode</dt><dd>{course.mode || '—'}</dd>
              <dt className="text-slate-500">Fee (₹)</dt><dd>{course.price ?? '—'}</dd>
              <dt className="text-slate-500">Trainer</dt><dd>{course.trainerName || '—'}</dd>
              <dt className="text-slate-500">Universities</dt><dd>{course.universities || '—'}</dd>
              <dt className="text-slate-500">Status</dt><dd>{course.active ? 'Active' : 'Draft'}</dd>
            </dl>
            {overviewDescriptionBlurb ? (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</h4>
                <p className="text-sm text-gray-700">{overviewDescriptionBlurb}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-200">
              <span className="text-sm text-slate-500">Curriculum modules: {(course.curriculum || []).length}</span>
              <span className="text-sm text-slate-500">Class links: {(course.classLinks || []).length}</span>
              <span className="text-sm text-slate-500">Materials: {(course.studyMaterials || []).length}</span>
            </div>

            <div className="pt-6 border-t border-gray-200 space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">Enrollment checkout — kit & coupons</h4>
              <p className="text-xs text-slate-gray">
                Optional training kit (12% GST) and per-course coupons. Successful redemptions count toward each code&apos;s limit.
              </p>
              {commerceMsg ? <p className="text-xs text-emerald-700">{commerceMsg}</p> : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={kitForm.enabled}
                  onChange={(e) => setKitForm((k) => ({ ...k, enabled: e.target.checked }))}
                />
                Enable training kit add-on
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Kit name</label>
                  <input
                    value={kitForm.name}
                    onChange={(e) => setKitForm((k) => ({ ...k, name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Price (₹ incl. GST)</label>
                  <input
                    value={kitForm.priceInr}
                    onChange={(e) => setKitForm((k) => ({ ...k, priceInr: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    inputMode="decimal"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Short description</label>
                <input
                  value={kitForm.shortDescription}
                  onChange={(e) => setKitForm((k) => ({ ...k, shortDescription: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Kit thumbnail URL (optional)</label>
                <input
                  value={kitForm.thumbnailUrl}
                  onChange={(e) => setKitForm((k) => ({ ...k, thumbnailUrl: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="/api/courses/media/featured/..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Course coupons</label>
                <CourseCouponsEditor rows={couponRows} onChange={setCouponRows} usedByCode={couponUsage} />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={saveCommerce}
                className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save kit & coupons
              </button>
            </div>
          </div>
        )}

        {activeTab === 'class-links' && (
          <ClassLinksTab classLinks={course.classLinks || []} onAdd={addClassLink} onRemove={removeClassLink} saving={saving} />
        )}

        {activeTab === 'materials' && (
          <MaterialsTab materials={course.studyMaterials || []} onAdd={addMaterial} onRemove={removeMaterial} saving={saving} />
        )}

        {activeTab === 'assignments' && (
          <AssignmentsTab
            assignments={course.assignments || []}
            onAdd={addAssignment}
            onUpdate={updateAssignment}
            onRemove={removeAssignment}
            saving={saving}
          />
        )}

        {activeTab === 'quizzes' && (
          <div className="space-y-8">
            <QuizzesTab
              quizzes={course.quizzes || []}
              onAdd={addQuiz}
              onUpdate={(i, q) => updateQuiz(i, q)}
              onRemove={removeQuiz}
              onOpenQuestionBuilder={(i) => setQuizEditorIdx(i)}
              saving={saving}
            />
            <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <h4 className="text-sm font-semibold text-brand-navy">Student quiz attempts (curriculum &amp; course quizzes)</h4>
              <p className="mt-1 text-xs text-slate-gray">
                Latest saved attempts per quiz title from student enrollments. MCQ/true-false practice quizzes in the course
                player sync here when students submit.
              </p>
              {quizAttemptsLoading ? (
                <p className="mt-3 text-sm text-slate-gray inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </p>
              ) : quizAttemptRows.length === 0 ? (
                <p className="mt-3 text-sm text-slate-gray">No quiz attempt data yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {quizAttemptRows.map((row) => (
                    <li key={row.enrollmentId} className="rounded-lg border border-gray-100 bg-white p-3 text-sm">
                      <p className="font-medium text-gray-900">
                        {row.studentName || 'Student'}
                        {row.email ? <span className="font-normal text-slate-500"> · {row.email}</span> : null}
                      </p>
                      <ul className="mt-2 divide-y divide-gray-100 text-xs">
                        {row.attempts.map((a) => (
                          <li key={`${row.enrollmentId}-${a.quizTitle}`} className="flex flex-wrap gap-2 py-1.5">
                            <span className="font-medium text-gray-800">{a.quizTitle}</span>
                            <span className={a.passed ? 'text-emerald-700' : 'text-amber-800'}>
                              {a.passed ? 'Passed' : 'Not passed'}
                            </span>
                            {typeof a.scorePercent === 'number' ? <span>{a.scorePercent}%</span> : null}
                            {typeof a.attempts === 'number' ? <span className="text-slate-500">tries: {a.attempts}</span> : null}
                            {a.updatedAt ? <span className="text-slate-400">{a.updatedAt}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-gray">
              Mark attendance per class session (from Class Links). Sessions can be marked on or after the scheduled date.
            </p>
            {attLoading ? (
              <p className="text-sm text-slate-gray inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance…
              </p>
            ) : !attData || !course?.classLinks?.length ? (
              <p className="text-sm text-slate-gray">Add class links with dates first, and ensure students are enrolled.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block text-xs font-medium text-gray-700">
                    Session
                    <select
                      className="mt-1 block min-w-[240px] rounded-md border border-gray-300 px-2 py-2 text-sm"
                      value={attSession}
                      onChange={(e) => setAttSession(e.target.value)}
                    >
                      {attData.sessions.map((s) => (
                        <option key={s.sessionKey} value={s.sessionKey} disabled={!s.canMark}>
                          {s.title} — {s.sessionDate || 'no date'}{s.canMark ? '' : ' (scheduled in future)'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!attSession || !attData.sessions.find((x) => x.sessionKey === attSession)?.canMark || attSaving}
                    onClick={() => {
                      const next: Record<string, string> = {}
                      for (const u of attData.students) next[u.userId] = 'present'
                      setAttStatusByUser(next)
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Mark all present
                  </button>
                  <button
                    type="button"
                    disabled={!attSession || !attData.sessions.find((x) => x.sessionKey === attSession)?.canMark || attSaving || !id}
                    onClick={async () => {
                      if (!id || !attSession) return
                      setAttSaving(true)
                      setAttMsg(null)
                      try {
                        const records = attData.students.map((u) => ({
                          userId: u.userId,
                          status: attStatusByUser[u.userId] ?? 'absent',
                          note: attNoteByUser[u.userId] ?? '',
                        }))
                        await adminService.putCourseAttendanceSession(id, attSession, { records })
                        const d = await adminService.getCourseAttendance(id)
                        setAttData(d)
                        setAttMsg('Attendance saved.')
                      } catch {
                        setAttMsg('Could not save attendance.')
                      } finally {
                        setAttSaving(false)
                      }
                    }}
                    className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {attSaving ? 'Saving…' : 'Save attendance'}
                  </button>
                </div>
                {attMsg ? <p className="text-sm text-emerald-700">{attMsg}</p> : null}
                {attSession && attData.sessions.find((x) => x.sessionKey === attSession)?.canMark ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Student</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {attData.students.map((u) => (
                          <tr key={u.userId}>
                            <td className="px-3 py-2">{u.name || '—'}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">{u.email}</td>
                            <td className="px-3 py-2">
                              <select
                                className="rounded border border-gray-300 px-2 py-1 text-xs"
                                value={attStatusByUser[u.userId] ?? 'present'}
                                onChange={(e) =>
                                  setAttStatusByUser((prev) => ({ ...prev, [u.userId]: e.target.value }))
                                }
                              >
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="late">Late</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                className="w-full min-w-[120px] rounded border border-gray-300 px-2 py-1 text-xs"
                                value={attNoteByUser[u.userId] ?? ''}
                                onChange={(e) =>
                                  setAttNoteByUser((prev) => ({ ...prev, [u.userId]: e.target.value }))
                                }
                                placeholder="Optional"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : attSession ? (
                  <p className="text-sm text-amber-800">This session is scheduled in the future — attendance opens on the session date.</p>
                ) : null}
              </>
            )}
          </div>
        )}

        {activeTab === 'announcements' && (
          <AnnouncementsTab announcements={course.announcements || []} onAdd={addAnnouncement} onRemove={removeAnnouncement} saving={saving} />
        )}

        {activeTab === 'enrolled' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
              <p className="text-xs font-medium text-gray-600">
                Filter enrollments. Pick a university to narrow colleges (dropdown). Course, branch, dates, and search work together with Apply.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-xs text-gray-600">
                  University
                  <select
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    value={enrollFilterDraft.university}
                    onChange={(ev) => setEnrollFilterDraft((f) => ({ ...f, university: ev.target.value, college: '' }))}
                  >
                    <option value="">Any</option>
                    {REGISTRATION_UNIVERSITIES_LIST.filter((u) => u.name !== OTHER_OPTION_VALUE).map((u) => (
                      <option key={u.name} value={u.name}>
                        {u.shortForm}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-gray-600">
                  College
                  {enrollCollegeOptions.length > 0 ? (
                    <select
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                      value={enrollFilterDraft.college}
                      onChange={(ev) => setEnrollFilterDraft((f) => ({ ...f, college: ev.target.value }))}
                    >
                      <option value="">Any</option>
                      {enrollCollegeOptions.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      value={enrollFilterDraft.college}
                      onChange={(ev) => setEnrollFilterDraft((f) => ({ ...f, college: ev.target.value }))}
                      placeholder="Contains…"
                    />
                  )}
                </label>
                <label className="block text-xs text-gray-600">
                  Course / program
                  <select
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    value={enrollFilterDraft.course}
                    onChange={(ev) => setEnrollFilterDraft((f) => ({ ...f, course: ev.target.value }))}
                  >
                    <option value="">Any</option>
                    {STUDENT_COURSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-gray-600">
                  Branch / stream
                  <select
                    className="mt-1 w-full max-h-40 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    value={enrollFilterDraft.branch}
                    onChange={(ev) => setEnrollFilterDraft((f) => ({ ...f, branch: ev.target.value }))}
                  >
                    <option value="">Any</option>
                    {BRANCHES_66.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-gray-600">
                  Enrolled from
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    value={enrollFilterDraft.dateFrom}
                    onChange={(ev) => setEnrollFilterDraft((f) => ({ ...f, dateFrom: ev.target.value }))}
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  Enrolled to
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    value={enrollFilterDraft.dateTo}
                    onChange={(ev) => setEnrollFilterDraft((f) => ({ ...f, dateTo: ev.target.value }))}
                  />
                </label>
                <label className="block text-xs text-gray-600 sm:col-span-2">
                  Search name, email, reg. no., mobile
                  <input
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    value={enrollFilterDraft.search}
                    onChange={(ev) => setEnrollFilterDraft((f) => ({ ...f, search: ev.target.value }))}
                    placeholder="Substring…"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  onClick={() => setEnrollFiltersApplied({ ...enrollFilterDraft })}
                >
                  Apply filters
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    const cleared = defaultEnrollFilters()
                    setEnrollFilterDraft(cleared)
                    setEnrollFiltersApplied(cleared)
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={enrollExportBusy || !id}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  onClick={async () => {
                    if (!id) return
                    setEnrollExportBusy(true)
                    setError(null)
                    try {
                      const blob = await adminService.downloadEnrollmentsCertificateSheet(
                        id,
                        enrollFiltersToQuery(enrollFiltersApplied),
                      )
                      const safe = (course?.title || 'enrollments').replace(/[^\w\-]+/g, '_').slice(0, 60) || 'enrollments'
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${safe}_enrollments.xlsx`
                      a.click()
                      URL.revokeObjectURL(url)
                    } catch (e: unknown) {
                      const msg =
                        e &&
                        typeof e === 'object' &&
                        'response' in e &&
                        e.response &&
                        typeof e.response === 'object' &&
                        'data' in e.response
                          ? String((e.response as { data?: { error?: string } }).data?.error ?? 'Download failed')
                          : 'Download failed'
                      setError(msg)
                    } finally {
                      setEnrollExportBusy(false)
                    }
                  }}
                >
                  {enrollExportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download Excel (filtered)
                </button>
              </div>
            </div>
            {enrollLoading ? (
              <p className="text-sm text-slate-gray">Loading enrollments…</p>
            ) : enrollments.length === 0 ? (
              <p className="text-sm text-slate-gray">
                {Object.values(enrollFiltersApplied).some((v) => v.trim() !== '')
                  ? 'No enrollments match these filters.'
                  : 'No enrolled students yet.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Mobile</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">University</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">College</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Course</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Branch</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Semester</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Reg. no.</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Enrolled</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Submissions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {enrollments.map((e) => (
                      <tr key={e.id}>
                        <td className="px-3 py-2">{e.name || '—'}</td>
                        <td className="px-3 py-2">{e.email}</td>
                        <td className="px-3 py-2">{e.mobile || '—'}</td>
                        <td className="px-3 py-2">{e.university || '—'}</td>
                        <td className="px-3 py-2">{e.collegeName || '—'}</td>
                        <td className="px-3 py-2">{e.course || '—'}</td>
                        <td className="px-3 py-2">{e.branch || e.stream || '—'}</td>
                        <td className="px-3 py-2">{e.semester || '—'}</td>
                        <td className="px-3 py-2">{e.registrationNumber || '—'}</td>
                        <td className="px-3 py-2">{e.enrolledAt}</td>
                        <td className="px-3 py-2">
                          <span className="mr-2 text-gray-600">{e.submissionsCount ?? 0}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSubmissionDownloadError(null)
                              setSubmissionViewer(e)
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-accent hover:bg-gray-50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {reviewsLoading ? (
              <p className="text-sm text-slate-gray">Loading reviews…</p>
            ) : adminReviews.length === 0 ? (
              <p className="text-sm text-slate-gray">No reviews for this training yet.</p>
            ) : (
              <ul className="space-y-3">
                {adminReviews.map((r) => (
                  <li
                    key={r.id}
                    className={`rounded-lg border p-4 text-sm ${r.flagged ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'} ${r.deleted ? 'opacity-50' : ''}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{r.studentName || 'Student'}</p>
                        <p className="text-xs text-gray-500">{r.createdAt}</p>
                      </div>
                      <span className="text-amber-600 font-medium">{r.rating}★</span>
                    </div>
                    {r.title ? <p className="mt-2 font-medium text-gray-800">{r.title}</p> : null}
                    <p className="mt-1 text-gray-700 whitespace-pre-wrap">{r.body}</p>
                    {!r.deleted ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!id) return
                            if (!window.confirm('Delete this review?')) return
                            try {
                              await adminService.deleteCourseReview(id, r.id)
                              setAdminReviews((prev) => prev.filter((x) => x.id !== r.id))
                            } catch {
                              setError('Could not delete review.')
                            }
                          }}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!id) return
                            try {
                              await adminService.flagCourseReview(id, r.id, !r.flagged)
                              setAdminReviews((prev) =>
                                prev.map((x) => (x.id === r.id ? { ...x, flagged: !r.flagged } : x)),
                              )
                            } catch {
                              setError('Could not update flag.')
                            }
                          }}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                        >
                          {r.flagged ? 'Unflag' : 'Flag'}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">Deleted</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {submissionViewer ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submission-modal-title"
          onClick={() => setSubmissionViewer(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 id="submission-modal-title" className="text-lg font-semibold text-brand-navy">
                Assignment submissions
              </h3>
              <button
                type="button"
                onClick={() => setSubmissionViewer(null)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-gray">
              {submissionViewer.name || 'Student'} · {submissionViewer.email}
            </p>
            {submissionDownloadError ? (
              <p className="mt-2 text-sm text-red-600" role="alert">{submissionDownloadError}</p>
            ) : null}
            <div className="mt-4 space-y-4">
              {(!submissionViewer.assignmentSubmissions || submissionViewer.assignmentSubmissions.length === 0) ? (
                <p className="text-sm text-slate-gray">No submissions yet for this learner.</p>
              ) : (
                submissionViewer.assignmentSubmissions.map((s, i) => (
                  <div key={`${s.assignmentId}-${i}`} className="rounded-lg border border-gray-100 p-3 text-sm">
                    <p className="font-medium text-gray-900">{s.assignmentTitle || s.assignmentId}</p>
                    {s.submittedAt ? (
                      <p className="mt-0.5 text-xs text-slate-500">Submitted: {s.submittedAt.replace('T', ' ').replace('Z', '')}</p>
                    ) : null}
                    {s.text ? (
                      <p className="mt-2 whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-gray-800">{s.text}</p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">No text note.</p>
                    )}
                    {s.fileStorageName ? (
                      <button
                        type="button"
                        onClick={() => void downloadSubmissionAdmin(s.fileStorageName!, s.originalFileName || 'download')}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
                      >
                        <Download className="h-3.5 w-3.5" /> Download file
                      </button>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">No file attached.</p>
                    )}
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => setSubmissionViewer(null)}
              className="mt-6 w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {quizEditorIdx !== null && course.quizzes?.[quizEditorIdx] ? (
        <QuizBuilderModal
          open
          moduleTitle={course.title || 'Course'}
          topicLabel={course.quizzes[quizEditorIdx].title || 'Quiz'}
          initialTitle={course.quizzes[quizEditorIdx].title}
          initialSummary={course.quizzes[quizEditorIdx].details ?? ''}
          initialQuestions={course.quizzes[quizEditorIdx].quizQuestions ?? []}
          initialSettings={course.quizzes[quizEditorIdx].quizSettings}
          onClose={() => setQuizEditorIdx(null)}
          onSave={(draft) => {
            const { published, ...rest } = draft
            const idx = quizEditorIdx
            updateQuiz(idx, {
              title: rest.title,
              details: rest.summary,
              quizQuestions: rest.questions,
              quizSettings: rest.settings,
              published,
            })
            setQuizEditorIdx(null)
          }}
        />
      ) : null}
    </div>
  )
}

function ClassLinksTab({
  classLinks,
  onAdd,
  onRemove,
  saving,
}: {
  classLinks: Array<{ title: string; date: string; time: string; platform: string; link: string; batch: string }>
  onAdd: (l: { title: string; date: string; time: string; platform: string; link: string; batch: string }) => void
  onRemove: (i: number) => void
  saving: boolean
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [platform, setPlatform] = useState('Zoom')
  const [link, setLink] = useState('')
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), date, time, platform, link: link.trim(), batch: '' })
    setTitle(''); setDate(''); setTime(''); setLink('')
  }
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session title" className="rounded border border-gray-300 px-2 py-1.5 text-sm w-40" required />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
          <option>Zoom</option>
          <option>Meet</option>
          <option>Teams</option>
          <option>YouTube</option>
        </select>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Meeting or YouTube URL" className="rounded border border-gray-300 px-2 py-1.5 text-sm min-w-[200px]" />
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Add</button>
      </form>
      <p className="text-xs text-slate-500">Sessions apply to all enrolled students. Use a youtube.com or youtu.be link when platform is YouTube.</p>
      {classLinks.length === 0 ? (
        <p className="text-sm text-slate-gray">No class links yet.</p>
      ) : (
        <ul className="space-y-2">
          {classLinks.map((l, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-2">
              <span className="font-medium">{l.title}</span> <span className="text-slate-500 text-xs">{l.date} {l.time} · {l.platform}</span>
              <a href={l.link} target="_blank" rel="noopener noreferrer" className="text-brand-accent text-sm truncate max-w-[180px]">{l.link || '—'}</a>
              <button type="button" onClick={() => onRemove(i)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function inferMaterialTypeFromFilename(name: string): string {
  const n = (name || '').toLowerCase()
  if (n.endsWith('.pdf')) return 'PDF'
  if (n.endsWith('.pptx') || n.endsWith('.ppt')) return 'PPT'
  if (n.endsWith('.docx') || n.endsWith('.doc')) return 'DOC'
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) return 'XLS'
  if (n.endsWith('.zip')) return 'ZIP'
  if (n.endsWith('.csv')) return 'CSV'
  if (n.endsWith('.txt')) return 'TXT'
  return 'File'
}

function MaterialsTab({
  materials,
  onAdd,
  onRemove,
  saving,
}: {
  materials: Array<{ title: string; module: string; type: string; url: string }>
  onAdd: (m: { title: string; module: string; type: string; url: string }) => void
  onRemove: (i: number) => void
  saving: boolean
}) {
  const [title, setTitle] = useState('')
  const [module, setModule] = useState('')
  const [type, setType] = useState('PDF')
  const [url, setUrl] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (!url.trim()) return
    onAdd({ title: title.trim(), module: module.trim(), type, url: url.trim() })
    setTitle('')
    setModule('')
    setUrl('')
    setType('PDF')
  }

  const onPickFile = () => fileRef.current?.click()

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError(null)
    setUploadBusy(true)
    try {
      const uploadedUrl = await adminService.uploadCourseMedia(file, 'material')
      setUrl(uploadedUrl)
      setType(inferMaterialTypeFromFilename(file.name))
      if (!title.trim()) {
        const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
        if (base) setTitle(base.slice(0, 120))
      }
    } catch {
      setUploadError('Upload failed. Check file type (PDF, Office, ZIP, TXT, CSV) and size limit.')
    } finally {
      setUploadBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Upload slides or handouts from your computer (stored like other course media), or paste an external HTTPS link.
        Allowed: PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, ZIP, TXT, CSV — max size is set on the server (default 50MB).
      </p>
      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
        <div className="flex flex-wrap gap-2 items-end">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title *"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm w-44 min-w-[10rem]"
            required
          />
          <input
            value={module}
            onChange={(e) => setModule(e.target.value)}
            placeholder="Module (optional)"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm w-36"
          />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option>PDF</option>
            <option>PPT</option>
            <option>DOC</option>
            <option>XLS</option>
            <option>ZIP</option>
            <option>TXT</option>
            <option>CSV</option>
            <option>File</option>
            <option>Video</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={(ev) => void onFileChange(ev)}
          />
          <button
            type="button"
            onClick={onPickFile}
            disabled={saving || uploadBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadBusy ? 'Uploading…' : 'Choose file from computer'}
          </button>
          <span className="text-xs text-slate-500">then review title and click Add to list</span>
        </div>
        {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
        <div>
          <label className="text-xs font-medium text-gray-600">Download URL (filled after upload, or paste external link)</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… or API URL after upload"
            className="mt-1 w-full max-w-xl rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button type="submit" disabled={saving || uploadBusy || !url.trim()} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Add to study materials
        </button>
      </form>
      {materials.length === 0 ? (
        <p className="text-sm text-slate-gray">No materials yet.</p>
      ) : (
        <ul className="space-y-2">
          {materials.map((m, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-2">
              <div className="min-w-0">
                <span className="font-medium text-gray-900">{m.title}</span>
                <span className="text-slate-500 text-xs"> · {m.type}{m.module ? ` · ${m.module}` : ''}</span>
                {m.url ? (
                  <p className="truncate text-[11px] text-slate-400 max-w-md" title={m.url}>
                    {m.url}
                  </p>
                ) : null}
              </div>
              <button type="button" onClick={() => onRemove(i)} className="p-1 text-red-600 hover:bg-red-50 rounded shrink-0" aria-label="Remove material">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AssignmentsTab({
  assignments,
  onAdd,
  onUpdate,
  onRemove,
  saving,
}: {
  assignments: Array<{ id?: string; title: string; dueDate: string; description: string; published?: boolean }>
  onAdd: (a: { title: string; dueDate: string; description: string }) => void
  onUpdate: (index: number, patch: Partial<{ title: string; dueDate: string; description: string; published: boolean }>) => void
  onRemove: (i: number) => void
  saving: boolean
}) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), dueDate, description: description.trim() })
    setTitle('')
    setDueDate('')
    setDescription('')
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-gray max-w-2xl">
        Flat assignments appear in the Assignments tab for students. <strong>Draft</strong> items stay hidden until you mark them published.
      </p>
      <form onSubmit={handleSubmit} className="max-w-md space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" required />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
          Add Assignment
        </button>
      </form>
      {assignments.length === 0 ? (
        <p className="text-sm text-slate-gray">No assignments yet.</p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a, i) => (
            <li key={a.id ?? i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-2">
              <div className="min-w-0">
                <span className="font-medium">{a.title}</span>
                {a.dueDate ? (
                  <span className="text-slate-500 text-xs ml-2">Due {a.dueDate}</span>
                ) : null}
                {a.published === false ? (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">Draft</span>
                ) : (
                  <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">Published</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={a.published !== false}
                    onChange={(e) => onUpdate(i, { published: e.target.checked })}
                  />
                  Published
                </label>
                <button type="button" onClick={() => onRemove(i)} className="p-1 text-red-600 hover:bg-red-50 rounded" aria-label="Remove assignment">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function QuizzesTab({
  quizzes,
  onAdd,
  onUpdate,
  onRemove,
  onOpenQuestionBuilder,
  saving,
}: {
  quizzes: Array<{
    id?: string
    title: string
    dueDate: string
    published?: boolean
    details?: string
    quizQuestions?: unknown[]
    quizSettings?: Partial<QuizSettingsDraft>
  }>
  onAdd: (q: { title: string; dueDate: string }) => void
  onUpdate: (
    index: number,
    q: {
      title: string
      dueDate: string
      published?: boolean
      details?: string
      quizQuestions?: unknown[]
      quizSettings?: Partial<QuizSettingsDraft>
    },
  ) => void
  onRemove: (i: number) => void
  onOpenQuestionBuilder: (index: number) => void
  saving: boolean
}) {
  const [selection, setSelection] = useState<'new' | number>('new')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [published, setPublished] = useState(true)

  const applySelection = (sel: 'new' | number) => {
    setSelection(sel)
    if (sel === 'new') {
      setTitle('')
      setDueDate('')
      setPublished(true)
    } else if (quizzes[sel]) {
      setTitle(quizzes[sel].title)
      setDueDate(quizzes[sel].dueDate || '')
      setPublished(quizzes[sel].published !== false)
    }
  }

  useEffect(() => {
    if (selection === 'new') return
    if (!quizzes[selection]) {
      applySelection('new')
      return
    }
    setTitle(quizzes[selection].title)
    setDueDate(quizzes[selection].dueDate || '')
    setPublished(quizzes[selection].published !== false)
  }, [quizzes, selection])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (selection === 'new') {
      onAdd({ title: title.trim(), dueDate })
      setTitle('')
      setDueDate('')
    } else {
      onUpdate(selection, { title: title.trim(), dueDate, published })
    }
  }

  const removeAt = (i: number) => {
    onRemove(i)
    if (selection === i) applySelection('new')
    else if (typeof selection === 'number' && selection > i) setSelection(selection - 1)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-gray max-w-2xl">
        Student-facing quizzes list. Use <strong>Questions &amp; settings</strong> to add MCQ, true/false, short answer, and
        fill-in-the-blank items (same builder as full course editor). <strong>Draft</strong> quizzes are hidden until
        published.
      </p>
      <div className="max-w-md space-y-1">
        <label htmlFor="quiz-select" className="block text-sm font-medium text-gray-700">
          Select quiz
        </label>
        <select
          id="quiz-select"
          value={selection === 'new' ? 'new' : String(selection)}
          onChange={(e) => {
            const v = e.target.value
            applySelection(v === 'new' ? 'new' : parseInt(v, 10))
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="new">Add new quiz…</option>
          {quizzes.map((q, i) => (
            <option key={q.id ?? `q_${i}`} value={String(i)}>
              {q.title || `Quiz ${i + 1}`}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">Choose an existing quiz to edit, or add a new one.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex max-w-xl flex-wrap items-end gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quiz title"
          className="w-48 min-w-[12rem] rounded border border-gray-300 px-2 py-1.5 text-sm"
          required
        />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        {selection !== 'new' ? (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded border-gray-300" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Published
          </label>
        ) : null}
        {selection !== 'new' ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => typeof selection === 'number' && onOpenQuestionBuilder(selection)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            Questions &amp; settings
          </button>
        ) : null}
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
          {selection === 'new' ? 'Add Quiz' : 'Save changes'}
        </button>
        {selection !== 'new' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => applySelection('new')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </form>
      {quizzes.length === 0 ? (
        <p className="text-sm text-slate-gray">No quizzes yet.</p>
      ) : (
        <ul className="space-y-2">
          {quizzes.map((q, i) => (
            <li key={q.id ?? `row_${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-2">
              <div className="min-w-0">
                <span className="font-medium">{q.title}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {(q.quizQuestions?.length ?? 0) === 0 ? 'No questions yet' : `${q.quizQuestions!.length} question(s)`}
                </span>
                {q.dueDate ? (
                  <span className="ml-2 text-xs text-slate-500">Due {q.dueDate}</span>
                ) : null}
                {q.published === false ? (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">Draft</span>
                ) : (
                  <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">Published</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={q.published !== false}
                    onChange={(e) =>
                      onUpdate(i, {
                        title: q.title,
                        dueDate: q.dueDate || '',
                        details: q.details,
                        quizQuestions: q.quizQuestions,
                        quizSettings: q.quizSettings,
                        published: e.target.checked,
                      })
                    }
                  />
                  Published
                </label>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  title="Delete quiz"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AnnouncementsTab({
  announcements,
  onAdd,
  onRemove,
  saving,
}: {
  announcements: Array<{ title: string; message: string; createdAt?: string }>
  onAdd: (a: { title: string; message: string }) => void
  onRemove: (i: number) => void
  saving: boolean
}) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return
    onAdd({ title: title.trim(), message: message.trim() })
    setTitle(''); setMessage('')
  }
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2 max-w-md">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" required />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" required />
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Post Announcement</button>
      </form>
      <p className="text-xs text-slate-500">All enrolled students can be notified (in-app + email when API is ready).</p>
      {announcements.length === 0 ? (
        <p className="text-sm text-slate-gray">No announcements yet.</p>
      ) : (
        <ul className="space-y-2">
          {announcements.map((a, i) => (
            <li key={i} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div><h4 className="font-medium">{a.title}</h4><p className="text-sm text-slate-600 mt-0.5">{a.message}</p></div>
                <button type="button" onClick={() => onRemove(i)} className="p-1 text-red-600 hover:bg-red-50 rounded shrink-0"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
