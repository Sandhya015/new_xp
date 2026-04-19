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
  Lock,
  Unlock,
} from 'lucide-react'
import { courseService, type CourseContent, type PythonQuizQuestion } from '@/services/courseService'
import { enrollmentService, type EnrollmentItem } from '@/services/enrollmentService'
import { certificateService } from '@/services/certificateService'
import { plainTextFromHtml, sanitizeRichHtml } from '@/utils/sanitizeHtml'
import { getYoutubeEmbedUrl, getYoutubeWatchUrl } from '@/utils/youtubeEmbed'
import { absoluteApiUrl } from '@/config/api'

const CERTIFICATE_PDF_DOWNLOAD_LIMIT = 2

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

function directVideoSrc(url: string): string | null {
  const u = (url || '').trim()
  if (!u) return null
  if (/^https?:\/\//i.test(u) && /\.(mp4|webm|mov)(\?|$)/i.test(u)) return u
  if (u.startsWith('/api/courses/media/')) return absoluteApiUrl(u)
  return null
}

function materialDownloadHref(url: string): string {
  const u = (url || '').trim()
  if (!u) return '#'
  if (/^https?:\/\//i.test(u)) return u
  return absoluteApiUrl(u.startsWith('/') ? u : `/${u.replace(/^\/+/, '')}`)
}

type EnrolledCurriculumTopic = {
  id?: string
  title?: string
  type?: string
  duration?: string
  details?: string
  lockedUntilPayment?: boolean
  lessonVideoUrl?: string
  lessonContent?: string
  lessonVideoAttachMode?: string
}

function completionQuizCopy(slug: string | undefined) {
  const s = (slug || '').toLowerCase()
  if (s === 'demo-java-programming-seed') {
    return {
      title: 'Java completion quiz',
      passedTitle: 'You have passed the Java completion quiz.',
      intro: 'Pass with at least {pct}% to unlock your certificate of completion.',
    }
  }
  if (s === 'aiml-foundations-seed') {
    return {
      title: 'AIML foundations quiz',
      passedTitle: 'You have passed the AIML foundations quiz.',
      intro: 'Pass with at least {pct}% to unlock your certificate of completion.',
    }
  }
  return {
    title: 'Python fundamentals quiz',
    passedTitle: 'You have passed the Python fundamentals quiz.',
    intro: 'Pass with at least {pct}% to unlock your certificate of completion.',
  }
}

function PythonCourseQuizBlock({
  courseId,
  courseSlug,
  passed,
  score,
  onUpdate,
  certificateIssued,
  certificateNumber,
  certBusy,
  certMessage,
  certMessageTone,
  certificateDownloadsRemaining,
  onGenerateCertificate,
}: {
  courseId: string
  courseSlug?: string
  passed: boolean
  score?: number
  onUpdate: () => void | Promise<void>
  certificateIssued?: boolean
  certificateNumber?: string | null
  certBusy?: boolean
  certMessage?: string | null
  certMessageTone?: 'success' | 'error' | 'info'
  certificateDownloadsRemaining?: number
  onGenerateCertificate?: () => void
}) {
  const copy = completionQuizCopy(courseSlug)
  const tone = certMessageTone ?? 'success'
  const feedbackClass =
    tone === 'error'
      ? 'text-red-800 bg-red-50 border-red-200'
      : tone === 'info'
        ? 'text-slate-800 bg-slate-50 border-slate-200'
        : 'text-emerald-900 bg-emerald-50/90 border-emerald-200'
  const downloadsLeft =
    typeof certificateDownloadsRemaining === 'number'
      ? certificateDownloadsRemaining
      : CERTIFICATE_PDF_DOWNLOAD_LIMIT
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
          <p className="font-semibold">{copy.passedTitle}</p>
          {score != null && <p className="mt-1 text-sm">Your score: {score}%</p>}
        </div>
        <p className="text-sm leading-relaxed text-emerald-950 bg-white/70 border border-emerald-100 rounded-lg px-3 py-2.5">
          Thank you for taking the quiz. We have emailed your certificate of completion to your registered email address
          (when outgoing mail is enabled on the server).
        </p>
        {certificateNumber && (
          <p className="text-sm text-emerald-800">
            Certificate ID:{' '}
            <span className="font-mono font-semibold text-brand-navy">{certificateNumber}</span>
          </p>
        )}
        {certMessage && (
          <p className={`text-sm rounded-lg border px-3 py-2 ${feedbackClass}`}>{certMessage}</p>
        )}
        {onGenerateCertificate && downloadsLeft > 0 ? (
          <button
            type="button"
            disabled={certBusy}
            onClick={onGenerateCertificate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {certBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {certificateIssued ? 'Generate certificate again' : 'Generate certificate (PDF)'}
          </button>
        ) : onGenerateCertificate && downloadsLeft <= 0 ? (
          <p className="text-sm text-emerald-900">
            You have used all {CERTIFICATE_PDF_DOWNLOAD_LIMIT} certificate generations for this course. Use the copies
            from your email, or contact support if you need help.
          </p>
        ) : null}
        <p className="text-xs text-emerald-800/90">
          You can generate the certificate PDF at most {CERTIFICATE_PDF_DOWNLOAD_LIMIT} times. Each successful generation
          downloads the PDF and emails a copy to your registered address when mail is configured on the server.
        </p>
        {downloadsLeft > 0 && downloadsLeft < CERTIFICATE_PDF_DOWNLOAD_LIMIT ? (
          <p className="text-xs font-medium text-emerald-900">
            Generations remaining: {downloadsLeft}
          </p>
        ) : null}
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
        <h3 className="text-lg font-semibold text-brand-navy">{copy.title}</h3>
        <p className="mt-1 text-sm text-slate-gray">{copy.intro.replace('{pct}', String(passPercent))}</p>
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
  const [certMessageTone, setCertMessageTone] = useState<'success' | 'error' | 'info'>('success')

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
    setCertMessageTone('success')
    certificateService
      .generateFromQuiz(courseId)
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `XpertIntern-certificate-${courseId.slice(-8)}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        setCertMessageTone('success')
        setCertMessage('Your certificate PDF has started downloading. A copy is also being sent to your email when mail is configured.')
        void refreshEnrollment()
      })
      .catch((err: unknown) => {
        const raw = err instanceof Error ? err.message : String(err)
        if (raw.startsWith('CERT_UI_UNCERTAIN|')) {
          setCertMessageTone('info')
          setCertMessage(raw.slice('CERT_UI_UNCERTAIN|'.length))
          void refreshEnrollment()
          return
        }
        const lower = raw.toLowerCase()
        if (lower.includes('network error') || lower.includes('failed to fetch')) {
          setCertMessageTone('info')
          setCertMessage(
            'We could not confirm the download in your browser. Your certificate may still have downloaded or been emailed — please check your downloads folder and inbox.',
          )
          void refreshEnrollment()
          return
        }
        setCertMessageTone('error')
        setCertMessage(raw || 'Could not generate certificate.')
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

      {(() => {
        const intro = (course.introVideoUrl || '').trim()
        if (!intro) return null
        const yt = getYoutubeEmbedUrl(intro)
        const watch = getYoutubeWatchUrl(intro)
        const direct = directVideoSrc(intro)
        return (
          <div className="mt-6 rounded-xl border border-gray-200 bg-slate-900/5 p-4 sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Intro video</h2>
            {yt ? (
              <div className="mt-3 aspect-video w-full max-w-3xl overflow-hidden rounded-lg border border-gray-200 bg-black shadow-sm">
                <iframe
                  title="Course intro"
                  src={yt}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : direct ? (
              <video
                className="mt-3 w-full max-w-3xl rounded-lg border border-gray-200 bg-black"
                controls
                playsInline
                preload="metadata"
                src={direct}
              >
                <track kind="captions" />
              </video>
            ) : (
              <p className="mt-2 text-sm text-gray-700">
                Open the intro in a new tab:{' '}
                <a href={intro} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-accent underline">
                  {intro.length > 80 ? `${intro.slice(0, 80)}…` : intro}
                </a>
              </p>
            )}
            {watch ? (
              <p className="mt-2 text-xs text-slate-600">
                <a href={watch} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                  Open on YouTube
                </a>
              </p>
            ) : null}
          </div>
        )
      })()}

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
        {activeTab === 'overview' && (() => {
          const raw = (course.fullDescription || course.description || '').trim()
          const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw)
          const goals = Array.isArray(course.whatYouWillLearn) ? course.whatYouWillLearn.filter((x) => String(x).trim()) : []
          return (
            <div className="max-w-none space-y-6">
              <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-5 sm:p-6">
                <h2 className="text-base font-semibold text-brand-navy">About this program</h2>
                {looksLikeHtml ? (
                  <div
                    className="prose prose-sm prose-slate mt-3 max-w-none text-gray-700 [&_a]:text-brand-accent [&_a]:underline [&_p]:mt-2 [&_ul]:mt-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(raw) }}
                  />
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-gray-700">{raw || 'No description yet.'}</p>
                )}
                {!looksLikeHtml && course.shortDescription?.trim() && (
                  <p className="mt-3 text-sm text-slate-gray">{course.shortDescription.trim()}</p>
                )}
                {looksLikeHtml && course.shortDescription?.trim() && (
                  <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-slate-gray">{course.shortDescription.trim()}</p>
                )}
              </div>
              {goals.length > 0 && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5 sm:p-6">
                  <h2 className="text-base font-semibold text-brand-navy">What you will learn</h2>
                  <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-gray-800">
                    {goals.map((g, i) => (
                      <li key={i}>{plainTextFromHtml(String(g))}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                {course.duration ? (
                  <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 text-center shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-gray">Duration</p>
                    <p className="mt-1 text-sm font-semibold text-brand-navy">{course.duration}</p>
                  </div>
                ) : null}
                {course.mode ? (
                  <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 text-center shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-gray">Mode</p>
                    <p className="mt-1 text-sm font-semibold text-brand-navy">{course.mode}</p>
                  </div>
                ) : null}
                {course.universities ? (
                  <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 text-center shadow-sm sm:col-span-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-gray">Universities</p>
                    <p className="mt-1 text-sm font-semibold text-brand-navy">{course.universities}</p>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })()}
        {activeTab === 'curriculum' && (
          <div className="space-y-4">
            {!course.curriculum || course.curriculum.length === 0 ? (
              <p className="text-slate-gray">No curriculum added yet.</p>
            ) : (
              (course.curriculum as Array<{
                id?: string
                title?: string
                name?: string
                topics?: Array<string | EnrolledCurriculumTopic>
              }>).map((mod, i) => {
                const priceNum = (() => {
                  const p = course.price
                  if (typeof p === 'number' && !Number.isNaN(p)) return p
                  const n = parseFloat(String(p ?? '').trim())
                  return Number.isFinite(n) ? n : 0
                })()
                const isFreeCourse = priceNum <= 0
                const hasPaidRecord = !!(enrollment?.orderId && String(enrollment.orderId).trim())
                const paymentUnlocked = isFreeCourse || hasPaidRecord
                return (
                  <div key={mod.id || i} className="rounded-lg border border-gray-100 p-3">
                    <h4 className="font-semibold text-brand-navy">{mod.title || mod.name || `Module ${i + 1}`}</h4>
                    {mod.topics && mod.topics.length > 0 && (
                      <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-100">
                        {mod.topics.map((t, j) => {
                          const topic: EnrolledCurriculumTopic =
                            typeof t === 'string' ? { title: t } : (t as EnrolledCurriculumTopic)
                          const title = topic.title || (typeof t === 'string' ? t : 'Topic')
                          const typ = topic.type ? ` · ${topic.type}` : ''
                          const dur = topic.duration ? ` · ${topic.duration}` : ''
                          const gated = !isFreeCourse && topic.lockedUntilPayment === true && !paymentUnlocked
                          const videoUrl = (topic.lessonVideoUrl || '').trim()
                          const ytEmbed = !gated && videoUrl ? getYoutubeEmbedUrl(videoUrl) : null
                          const directVideo = !gated && videoUrl ? directVideoSrc(videoUrl) : null
                          const notesHtml = (topic.lessonContent || '').trim() || (topic.details || '').trim()
                          const isLecture = (topic.type || 'Lecture') === 'Lecture'
                          const isQuiz = topic.type === 'Quiz'
                          return (
                            <li key={topic.id || j} className="px-3 py-3 text-sm text-gray-700">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="min-w-0">
                                  <span className="font-medium text-gray-900">{title}</span>
                                  <span className="text-gray-500">{typ}</span>
                                  <span className="text-gray-400">{dur}</span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500">
                                  {gated ? (
                                    <>
                                      <Lock className="h-4 w-4 text-amber-600" aria-hidden />
                                      <span>Complete payment to unlock</span>
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="h-4 w-4 text-emerald-600" aria-hidden />
                                      <span>Unlocked</span>
                                    </>
                                  )}
                                </span>
                              </div>
                              {!gated && isLecture && (ytEmbed || directVideo) ? (
                                <div className="mt-3 aspect-video w-full max-w-2xl overflow-hidden rounded-lg border border-gray-200 bg-black shadow-sm">
                                  {ytEmbed ? (
                                    <iframe
                                      title={title}
                                      src={ytEmbed}
                                      className="h-full w-full"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                      allowFullScreen
                                      referrerPolicy="strict-origin-when-cross-origin"
                                    />
                                  ) : (
                                    <video
                                      className="h-full w-full"
                                      controls
                                      playsInline
                                      preload="metadata"
                                      src={directVideo || undefined}
                                    >
                                      <track kind="captions" />
                                    </video>
                                  )}
                                </div>
                              ) : null}
                              {gated && isLecture && videoUrl ? (
                                <p className="mt-2 text-xs text-amber-800">Lesson video is available after your enrollment shows a successful payment.</p>
                              ) : null}
                              {!gated && isLecture && notesHtml ? (
                                <div
                                  className="prose prose-sm prose-slate mt-3 max-w-none text-gray-700 [&_a]:text-brand-accent [&_p]:mt-2 [&_ul]:mt-2"
                                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(notesHtml) }}
                                />
                              ) : null}
                              {!gated && isQuiz ? (
                                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                                  This topic is a <strong>curriculum quiz</strong> (study checklist). For scored completion
                                  and certificates (when enabled), use the <strong>Quizzes</strong> tab.
                                </p>
                              ) : null}
                              {!gated && topic.type === 'Assignment' ? (
                                <p className="mt-2 text-xs text-slate-600">
                                  Assignment instructions appear here when your trainer publishes them in full.
                                </p>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {!isFreeCourse && !paymentUnlocked ? (
                      <p className="mt-2 text-xs text-amber-800">
                        Some lessons stay locked until your enrollment is linked to a successful payment (order on file).
                      </p>
                    ) : null}
                  </div>
                )
              })
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
                      href={materialDownloadHref(m.url)}
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
                courseSlug={course.slug}
                passed={!!enrollment.pythonQuizPassed}
                score={enrollment.pythonQuizScore}
                onUpdate={refreshEnrollment}
                certificateIssued={!!enrollment.certificateIssued}
                certificateNumber={enrollment.certificateNumber}
                certBusy={certBusy}
                certMessage={certMessage}
                certMessageTone={certMessageTone}
                certificateDownloadsRemaining={
                  enrollment.certificatePdfDownloadsRemaining ?? CERTIFICATE_PDF_DOWNLOAD_LIMIT
                }
                onGenerateCertificate={
                  enrollment.pythonQuizPassed ? handleGenerateCertificate : undefined
                }
              />
            )}
            {(!course.quizzes || course.quizzes.length === 0) ? (
              !enrollment?.pythonQuizAvailable && <p className="text-slate-gray">No quizzes yet.</p>
            ) : (
              <div className="space-y-3">
                {enrollment?.pythonQuizAvailable && course.quizzes && course.quizzes.length > 0 && (
                  <p className="text-sm font-medium text-brand-navy">Additional quizzes</p>
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
                    Pass the <strong>{completionQuizCopy(course.slug).title}</strong> in the <strong>Quizzes</strong> tab, then use{' '}
                    <strong>Generate certificate</strong> there to get your PDF (and email copy when configured).
                  </p>
                )}
                {enrollment.pythonQuizPassed && (
                  <p className="font-medium text-gray-700">
                    You have passed the quiz. Open the <strong>Quizzes</strong> tab and use <strong>Generate certificate (PDF)</strong>{' '}
                    below your pass message to download and email your certificate.
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
