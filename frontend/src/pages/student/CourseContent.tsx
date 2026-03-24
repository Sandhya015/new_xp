/**
 * Student Dashboard — View Enrolled Course Content (SD-WF-10).
 * Tabs: Overview, Curriculum, Class Links, Study Materials, Assignments, Quizzes, Announcements, Certificate.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  BookOpen,
  ListOrdered,
  Link2,
  FileText,
  ClipboardList,
  HelpCircle,
  Send,
  Award,
  ArrowLeft,
  ExternalLink,
  Download,
  Loader2,
} from 'lucide-react'
import { courseService, type CourseContent, type PythonQuizQuestion } from '@/services/courseService'
import { enrollmentService, type EnrollmentItem } from '@/services/enrollmentService'
import { certificateService } from '@/services/certificateService'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'curriculum', label: 'Curriculum', icon: ListOrdered },
  { id: 'class-links', label: 'Class Links', icon: Link2 },
  { id: 'materials', label: 'Study Materials', icon: FileText },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
  { id: 'quizzes', label: 'Quizzes', icon: HelpCircle },
  { id: 'announcements', label: 'Announcements', icon: Send },
  { id: 'certificate', label: 'Certificate', icon: Award },
] as const

function PythonCourseQuizBlock({
  courseId,
  passed,
  score,
  onUpdate,
  certificateIssued,
  certificateNumber,
  certBusy,
  certMessage,
  onGenerateCertificate,
}: {
  courseId: string
  passed: boolean
  score?: number
  onUpdate: () => void | Promise<void>
  certificateIssued?: boolean
  certificateNumber?: string | null
  certBusy?: boolean
  certMessage?: string | null
  onGenerateCertificate?: () => void
}) {
  const [loading, setLoading] = useState(!passed)
  const [questions, setQuestions] = useState<PythonQuizQuestion[]>([])
  const [passPercent, setPassPercent] = useState(60)
  const [selections, setSelections] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    if (passed) {
      setLoading(false)
      return
    }
    setLoading(true)
    setBanner(null)
    courseService
      .getPythonQuiz(courseId)
      .then((d) => {
        setQuestions(d.questions)
        setPassPercent(d.passPercent)
        setSelections(Array(d.questions.length).fill(-1))
      })
      .catch(() => setBanner('Could not load the quiz. Try again later.'))
      .finally(() => setLoading(false))
  }, [courseId, passed])

  const submit = async () => {
    if (selections.some((i) => i < 0)) {
      setBanner('Please answer every question.')
      return
    }
    setSubmitting(true)
    setBanner(null)
    try {
      const res = await enrollmentService.submitPythonQuiz(courseId, selections)
      if (res.alreadyCompleted || res.passed) {
        await onUpdate()
        setBanner(null)
      } else {
        setBanner(res.message || `You scored ${res.scorePercent}%. You need ${res.passPercent}% to pass.`)
      }
    } catch {
      setBanner('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (passed) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 space-y-4">
        <div>
          <p className="font-semibold">You have passed the Python fundamentals quiz.</p>
          {score != null && <p className="mt-1 text-sm">Your score: {score}%</p>}
        </div>
        {certificateNumber && (
          <p className="text-sm text-emerald-800">
            Certificate ID:{' '}
            <span className="font-mono font-semibold text-brand-navy">{certificateNumber}</span>
          </p>
        )}
        {certMessage && (
          <p className="text-sm text-emerald-800 bg-white/60 border border-emerald-200/80 rounded-lg px-3 py-2">{certMessage}</p>
        )}
        {onGenerateCertificate && (
          <button
            type="button"
            disabled={certBusy}
            onClick={onGenerateCertificate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {certBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {certificateIssued ? 'Download certificate again' : 'Generate certificate (PDF)'}
          </button>
        )}
        <p className="text-xs text-emerald-800/90">
          First time you generate, we email a copy to your registered address (if mail is configured on the server).
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-gray">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading quiz…
      </div>
    )
  }

  if (banner && questions.length === 0) {
    return <p className="text-red-600">{banner}</p>
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-navy/15 bg-[#f8fafc] p-4">
      <div>
        <h3 className="text-lg font-semibold text-brand-navy">Python fundamentals quiz</h3>
        <p className="mt-1 text-sm text-slate-gray">
          Pass with at least {passPercent}% to unlock your certificate of completion.
        </p>
      </div>
      {banner && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{banner}</p>}
      <ol className="space-y-6">
        {questions.map((q, qi) => (
          <li key={q.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="font-medium text-gray-900">
              {qi + 1}. {q.question}
            </p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt, oi) => (
                <label key={oi} className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name={q.id}
                    className="mt-1"
                    checked={selections[qi] === oi}
                    onChange={() => {
                      const next = [...selections]
                      next[qi] = oi
                      setSelections(next)
                    }}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={submitting || questions.length === 0}
        onClick={() => void submit()}
        className="rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit quiz'}
      </button>
    </div>
  )
}

export function CourseContent() {
  const { id: courseId } = useParams<{ id: string }>()
  const [course, setCourse] = useState<CourseContent | null>(null)
  const [enrollment, setEnrollment] = useState<EnrollmentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [certBusy, setCertBusy] = useState(false)
  const [certMessage, setCertMessage] = useState<string | null>(null)

  const refreshEnrollment = useCallback(() => {
    if (!courseId) return Promise.resolve()
    return enrollmentService.getByCourseId(courseId).then(setEnrollment).catch(() => setEnrollment(null))
  }, [courseId])

  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    setError(null)
    courseService
      .getContent(courseId)
      .then(setCourse)
      .catch(() => {
        setCourse(null)
        setError('Unable to load course content.')
      })
      .finally(() => setLoading(false))
  }, [courseId])

  useEffect(() => {
    refreshEnrollment()
  }, [refreshEnrollment])

  const handleGenerateCertificate = useCallback(() => {
    if (!courseId) return
    setCertBusy(true)
    setCertMessage(null)
    certificateService
      .generateFromQuiz(courseId)
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `XpertIntern-certificate-${courseId.slice(-8)}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        setCertMessage('Download started. If this was your first issue, check your inbox for the certificate email.')
        void refreshEnrollment()
      })
      .catch((err: unknown) => {
        setCertMessage(err instanceof Error ? err.message : 'Could not generate certificate.')
      })
      .finally(() => setCertBusy(false))
  }, [courseId, refreshEnrollment])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-slate-gray">Loading course...</p>
      </div>
    )
  }
  if (error || !course) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-red-600">{error || 'Course not found.'}</p>
        <Link to="/dashboard/my-courses" className="mt-4 inline-block text-brand-accent font-semibold hover:underline">
          ← Back to My Courses
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/dashboard/my-courses"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Courses
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-brand-navy">{course.title}</h1>
      {course.trainerName && (
        <p className="mt-1 text-sm text-slate-gray">Trainer: {course.trainerName}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'border-b-2 border-brand-accent bg-white text-brand-accent'
                : 'text-slate-gray hover:bg-gray-50 hover:text-brand-navy'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-b-xl border border-t-0 border-gray-200 bg-white p-6 shadow-sm">
        {activeTab === 'overview' && (
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700">{course.fullDescription || course.description || 'No description.'}</p>
            <ul className="mt-4 list-inside list-disc text-gray-600">
              {course.duration && <li>Duration: {course.duration}</li>}
              {course.mode && <li>Mode: {course.mode}</li>}
              {course.universities && <li>Universities: {course.universities}</li>}
            </ul>
          </div>
        )}
        {activeTab === 'curriculum' && (
          <div className="space-y-4">
            {(!course.curriculum || course.curriculum.length === 0) ? (
              <p className="text-slate-gray">No curriculum added yet.</p>
            ) : (
              (course.curriculum as Array<{ name?: string; topics?: string[] }>).map((mod, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-3">
                  <h4 className="font-semibold text-brand-navy">{mod.name || `Module ${i + 1}`}</h4>
                  {mod.topics && mod.topics.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-sm text-gray-600">
                      {mod.topics.map((t, j) => (
                        <li key={j}>{typeof t === 'string' ? t : (t as { title?: string })?.title || 'Topic'}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'class-links' && (
          <div className="space-y-3">
            {(!course.classLinks || course.classLinks.length === 0) ? (
              <p className="text-slate-gray">No class links yet.</p>
            ) : (
              course.classLinks.map((cl, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <p className="font-medium text-gray-800">{cl.title || 'Session'}</p>
                    <p className="text-xs text-slate-gray">{cl.date} {cl.time} · {cl.platform}</p>
                  </div>
                  {cl.link && (
                    <a
                      href={cl.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
                    >
                      Join <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'materials' && (
          <div className="space-y-3">
            {(!course.studyMaterials || course.studyMaterials.length === 0) ? (
              <p className="text-slate-gray">No study materials yet.</p>
            ) : (
              course.studyMaterials.map((m, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <p className="font-medium text-gray-800">{m.title}</p>
                    <p className="text-xs text-slate-gray">{m.module} · {m.type}</p>
                  </div>
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" /> Download
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'assignments' && (
          <div className="space-y-3">
            {(!course.assignments || course.assignments.length === 0) ? (
              <p className="text-slate-gray">No assignments yet.</p>
            ) : (
              course.assignments.map((a, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-3">
                  <p className="font-medium text-gray-800">{a.title}</p>
                  {a.dueDate && <p className="text-xs text-slate-gray">Due: {a.dueDate}</p>}
                  {a.description && <p className="mt-1 text-sm text-gray-600">{a.description}</p>}
                  <button type="button" className="mt-2 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                    Upload Submission
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'quizzes' && (
          <div className="space-y-6">
            {enrollment?.pythonQuizAvailable && courseId && (
              <PythonCourseQuizBlock
                courseId={courseId}
                passed={!!enrollment.pythonQuizPassed}
                score={enrollment.pythonQuizScore}
                onUpdate={refreshEnrollment}
                certificateIssued={!!enrollment.certificateIssued}
                certificateNumber={enrollment.certificateNumber}
                certBusy={certBusy}
                certMessage={certMessage}
                onGenerateCertificate={
                  enrollment.pythonQuizPassed ? handleGenerateCertificate : undefined
                }
              />
            )}
            {(!course.quizzes || course.quizzes.length === 0) ? (
              !enrollment?.pythonQuizAvailable && <p className="text-slate-gray">No quizzes yet.</p>
            ) : (
              <div className="space-y-3">
                {enrollment?.pythonQuizAvailable && (
                  <p className="text-sm font-medium text-brand-navy">Other course quizzes</p>
                )}
                {course.quizzes.map((q, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                    <div>
                      <p className="font-medium text-gray-800">{q.title}</p>
                      {q.dueDate && <p className="text-xs text-slate-gray">Due: {q.dueDate}</p>}
                    </div>
                    <button type="button" className="rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600">
                      Start Quiz
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'announcements' && (
          <div className="space-y-3">
            {(!course.announcements || course.announcements.length === 0) ? (
              <p className="text-slate-gray">No announcements yet.</p>
            ) : (
              course.announcements.map((a, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-3">
                  <p className="font-medium text-gray-800">{a.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{a.message}</p>
                  {a.createdAt && <p className="mt-1 text-xs text-slate-gray">{a.createdAt}</p>}
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'certificate' && (
          <div className="rounded-lg border border-gray-100 p-6 text-center space-y-4">
            <Award className="mx-auto h-12 w-12 text-gray-400" />
            {enrollment?.pythonQuizAvailable ? (
              <>
                {!enrollment.pythonQuizPassed && (
                  <p className="font-medium text-gray-700">
                    Pass the <strong>Python fundamentals quiz</strong> in the <strong>Quizzes</strong> tab, then use{' '}
                    <strong>Generate certificate</strong> there to download your PDF.
                  </p>
                )}
                {enrollment.pythonQuizPassed && (
                  <p className="font-medium text-gray-700">
                    You have passed the quiz. Open the <strong>Quizzes</strong> tab and use <strong>Generate certificate (PDF)</strong>{' '}
                    below your pass message to download (and trigger the certificate email on first issue).
                  </p>
                )}
              </>
            ) : (
              <p className="font-medium text-gray-700">Certificate will be issued on course completion.</p>
            )}
            <Link to="/dashboard/certificates" className="mt-2 inline-block text-brand-accent font-semibold hover:underline">
              View My Certificates
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
