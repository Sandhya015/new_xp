/**
 * Student Dashboard — View Enrolled Course Content (SD-WF-10).
 * Tabs: Overview, Curriculum, Class Links, Study Materials, Assignments, Quizzes, Announcements, Certificate.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
  UserCheck,
} from 'lucide-react'
import { courseService, type CourseContent, type PythonQuizQuestion } from '@/services/courseService'
import type { EnrollmentItem } from '@/services/enrollmentService'
import { enrollmentService, type AssignmentSubmissionItem } from '@/services/enrollmentService'
import { certificateService } from '@/services/certificateService'
import { plainTextFromHtml, sanitizeRichHtml } from '@/utils/sanitizeHtml'
import { getYoutubeEmbedUrl, getYoutubeWatchUrl } from '@/utils/youtubeEmbed'
import { absoluteApiUrl } from '@/config/api'
import { migrateQuizQuestion, type QuizQuestionDraft } from '@/components/admin/quizQuestionTypes'

const CERTIFICATE_PDF_DOWNLOAD_LIMIT = 2

function classLinkIsYoutube(cl: { platform?: string; link?: string }) {
  const p = (cl.platform || '').toLowerCase()
  const u = (cl.link || '').toLowerCase()
  return p === 'youtube' || u.includes('youtube.com') || u.includes('youtu.be')
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'curriculum', label: 'Curriculum', icon: ListOrdered },
  { id: 'class-links', label: 'Class Links', icon: Link2 },
  { id: 'materials', label: 'Study Materials', icon: FileText },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
  { id: 'quizzes', label: 'Quizzes', icon: HelpCircle },
  { id: 'attendance', label: 'Attendance', icon: UserCheck },
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

function findMatchingFlatAssignment(
  course: CourseContent | null,
  topicTitle: string,
  assignMeta?: { title?: string },
): { id: string; title: string; dueDate?: string; description?: string } | null {
  if (!course?.assignments?.length) return null
  const want = (assignMeta?.title || topicTitle || '').trim().toLowerCase()
  if (!want) return null
  const list = course.assignments
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    const t = (a.title || '').trim().toLowerCase()
    if (!t || t !== want) continue
    const aid = a.id?.trim() ? String(a.id) : `idx_${i}`
    return { id: aid, title: a.title || topicTitle, dueDate: a.dueDate, description: a.description }
  }
  return null
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
  lessonExerciseFileName?: string
  lessonVideoFileName?: string
  assignment?: {
    title?: string
    instructions?: string
    maxMarks?: string
    deadline?: string
    allowText?: boolean
    allowPdf?: boolean
    allowDoc?: boolean
    allowZip?: boolean
    questions?: Array<{ prompt?: string }>
    attachments?: Array<{ name?: string; url?: string }>
  }
  quizQuestions?: unknown[]
  quizSettings?: unknown
}

const ADDITIONAL_QUIZ_DEFAULT_PASS = 60

type AdditionalQuizRow = { title: string; dueDate?: string; flatQuiz?: { quizQuestions?: unknown[]; quizSettings?: unknown } }

/**
 * Names come from curriculum Quiz topics (what admins author in the builder).
 * course.quizzes is merged for due dates and legacy rows not yet in curriculum.
 */
function listQuizTopicsFromCurriculum(curriculum: unknown): AdditionalQuizRow[] {
  const out: AdditionalQuizRow[] = []
  if (!Array.isArray(curriculum)) return out
  for (const mod of curriculum) {
    const topics = (mod as { topics?: unknown[] })?.topics
    if (!Array.isArray(topics)) continue
    for (const raw of topics) {
      const t = raw as { type?: string; title?: string; dueDate?: string; duration?: string }
      if (String(t.type || '').toLowerCase() !== 'quiz') continue
      const title = String(t.title || '').trim()
      if (!title) continue
      const due = t.dueDate || t.duration
      out.push({ title, dueDate: typeof due === 'string' && due.trim() ? due.trim() : undefined })
    }
  }
  return out
}

function buildAdditionalQuizList(
  curriculum: unknown,
  courseQuizzes:
    | Array<{
        title?: string
        dueDate?: string
        quizQuestions?: unknown[]
        quizSettings?: unknown
      }>
    | undefined,
): AdditionalQuizRow[] {
  const fromCurriculum = listQuizTopicsFromCurriculum(curriculum)
  const map = new Map<string, AdditionalQuizRow>()
  for (const row of fromCurriculum) {
    const k = row.title.toLowerCase()
    if (!map.has(k)) {
      map.set(k, { title: row.title, dueDate: row.dueDate })
    }
  }
  for (const q of courseQuizzes || []) {
    const title = String(q.title || '').trim()
    if (!title) continue
    const k = title.toLowerCase()
    const existing = map.get(k)
    const flatPayload =
      Array.isArray(q.quizQuestions) && q.quizQuestions.length > 0
        ? { quizQuestions: q.quizQuestions, quizSettings: q.quizSettings }
        : undefined
    if (existing) {
      if (q.dueDate && !existing.dueDate) {
        existing.dueDate = q.dueDate
      }
      if (flatPayload && !existing.flatQuiz) {
        existing.flatQuiz = flatPayload
      }
    } else {
      map.set(k, { title, dueDate: q.dueDate, ...(flatPayload ? { flatQuiz: flatPayload } : {}) })
    }
  }
  return Array.from(map.values())
}

type AdditionalQuizModuleGroup = { moduleTitle: string; rows: AdditionalQuizRow[] }

/**
 * Group curriculum Quiz rows by parent module. Excludes the completion assessment title and attaches due dates from flat.
 * Remaining flat rows (e.g. legacy `course.quizzes` only) go under "Other course quizzes".
 */
function buildQuizModuleGroups(
  curriculum: unknown,
  flat: AdditionalQuizRow[],
  completionTitle: string,
): AdditionalQuizModuleGroup[] {
  const ckey = (completionTitle || '').trim().toLowerCase()
  const dueByTitle = new Map(flat.map((r) => [r.title.trim().toLowerCase(), r]))
  const groups: AdditionalQuizModuleGroup[] = []
  const seen = new Set<string>()
  if (Array.isArray(curriculum)) {
    for (const mod of curriculum) {
      const m = mod as { title?: string; topics?: unknown[] }
      const moduleTitle = String(m.title || 'Module').trim() || 'Module'
      const rowChunk: AdditionalQuizRow[] = []
      const topics = m.topics
      if (Array.isArray(topics)) {
        for (const raw of topics) {
          const t = raw as { type?: string; title?: string }
          if (String(t.type || '').toLowerCase() !== 'quiz') continue
          const title = String(t.title || '').trim()
          if (!title) continue
          const k = title.toLowerCase()
          if (ckey && k === ckey) continue
          const ex = dueByTitle.get(k)
          rowChunk.push({ title, dueDate: ex?.dueDate })
          seen.add(k)
        }
      }
      if (rowChunk.length) {
        groups.push({ moduleTitle, rows: rowChunk })
      }
    }
  }
  const orphan: AdditionalQuizRow[] = []
  for (const r of flat) {
    const t = (r.title || '').trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (ckey && k === ckey) continue
    if (!seen.has(k)) orphan.push(r)
  }
  if (orphan.length) {
    groups.push({ moduleTitle: 'Other course quizzes', rows: orphan })
  }
  return groups
}

type QuizProgressRow = { title: string; kind: 'module' | 'completion'; status: 'not_started' | 'passed' | 'failed' }

function computeQuizProgress(course: CourseContent | null, enrollment: EnrollmentItem | null): {
  rows: QuizProgressRow[]
  passed: number
  failed: number
  pending: number
  total: number
  allPassed: boolean
} {
  const empty = { rows: [], passed: 0, failed: 0, pending: 0, total: 0, allPassed: false }
  if (!course) return empty
  const ckey = (course.completionQuizTitle || '').trim().toLowerCase()
  const rows: QuizProgressRow[] = []
  if (Array.isArray(course.curriculum)) {
    for (const mod of course.curriculum) {
      const topics = (mod as { topics?: unknown[] })?.topics
      if (!Array.isArray(topics)) continue
      for (const raw of topics) {
        const t = raw as { title?: string; type?: string }
        if (String(t.type || '').toLowerCase() !== 'quiz') continue
        const title = String(t.title || '').trim()
        if (!title) continue
        if (ckey && title.toLowerCase() === ckey) continue
        const att = enrollment?.curriculumQuizAttempts?.find(
          (a) => String(a.quizTitle || '').trim().toLowerCase() === title.toLowerCase(),
        )
        let status: QuizProgressRow['status'] = 'not_started'
        if (att) status = att.passed ? 'passed' : 'failed'
        rows.push({ title, kind: 'module', status })
      }
    }
  }
  if (enrollment?.pythonQuizAvailable) {
    const slug = (course.slug || '').toLowerCase()
    const defaultCompletion =
      slug === 'demo-java-programming-seed' ? 'Java completion quiz' : 'Python fundamentals quiz'
    const ct = (course.completionQuizTitle || '').trim() || defaultCompletion
    rows.push({
      title: ct,
      kind: 'completion',
      status: enrollment.pythonQuizPassed ? 'passed' : 'not_started',
    })
  }
  const passed = rows.filter((r) => r.status === 'passed').length
  const failed = rows.filter((r) => r.status === 'failed').length
  const pending = rows.filter((r) => r.status === 'not_started').length
  const total = rows.length
  const allPassed = total > 0 && passed === total
  return { rows, passed, failed, pending, total, allPassed }
}

function QuizProgressSummary({ course, enrollment }: { course: CourseContent; enrollment: EnrollmentItem | null }) {
  const p = useMemo(() => computeQuizProgress(course, enrollment), [course, enrollment])
  if (p.total === 0) return null
  const pct = Math.round((100 * p.passed) / p.total)
  return (
    <div className="rounded-xl border border-brand-navy/15 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-brand-navy">Your quiz progress</h3>
        <span className="text-sm font-medium text-slate-700">
          {p.passed}/{p.total} passed · {p.failed} failed · {p.pending} not completed
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 text-sm">
        {p.rows.map((r) => (
          <li
            key={`${r.kind}-${r.title}`}
            className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 bg-[#f8fafc] px-3 py-2"
          >
            <span className="text-gray-800 font-medium line-clamp-2">{r.title}</span>
            <span
              className={
                r.status === 'passed'
                  ? 'shrink-0 text-emerald-700 font-semibold'
                  : r.status === 'failed'
                    ? 'shrink-0 text-red-700 font-semibold'
                    : 'shrink-0 text-slate-500'
              }
            >
              {r.status === 'passed' ? 'Passed' : r.status === 'failed' ? 'Failed' : 'Not completed'}
            </span>
          </li>
        ))}
      </ul>
      {p.allPassed ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          <p className="font-semibold">All quizzes completed</p>
          <p className="mt-1 text-emerald-950/90">
            Thank you. You will receive an email about your certificate once your results have been processed.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function findCurriculumQuizTopic(
  curriculum: unknown,
  quizListTitle: string,
): { quizQuestions: unknown[]; passPercent: number } | null {
  const want = (quizListTitle || '').trim().toLowerCase()
  if (!want || !Array.isArray(curriculum)) return null
  for (const mod of curriculum) {
    const topics = (mod as { topics?: unknown[] })?.topics
    if (!Array.isArray(topics)) continue
    for (const raw of topics) {
      const t = raw as { title?: string; type?: string; quizQuestions?: unknown[]; quizSettings?: { passingGradePercent?: string } }
      if (String(t.type || '').toLowerCase() !== 'quiz') continue
      if (String(t.title || '').trim().toLowerCase() !== want) continue
      const qs = t.quizQuestions
      const p = t.quizSettings?.passingGradePercent
      let pass = ADDITIONAL_QUIZ_DEFAULT_PASS
      if (typeof p === 'string' && p.trim()) {
        const n = parseInt(p, 10)
        if (!Number.isNaN(n) && n >= 0 && n <= 100) pass = n
      }
      return { quizQuestions: Array.isArray(qs) ? qs : [], passPercent: pass }
    }
  }
  return null
}

function passingGradePercentFromQuizSettings(settings: unknown): number {
  if (!settings || typeof settings !== 'object') return ADDITIONAL_QUIZ_DEFAULT_PASS
  const p = (settings as { passingGradePercent?: string }).passingGradePercent
  if (typeof p === 'string' && p.trim()) {
    const n = parseInt(p, 10)
    if (!Number.isNaN(n) && n >= 0 && n <= 100) return n
  }
  return ADDITIONAL_QUIZ_DEFAULT_PASS
}

/** MCQ + True/False only for in-browser additional quizzes (same shape as completion quiz). */
function buildAdditionalQuizPlayerPayload(rawQuestions: unknown[]): { questions: PythonQuizQuestion[]; correctIndices: number[] } {
  const questions: PythonQuizQuestion[] = []
  const correctIndices: number[] = []
  if (!Array.isArray(rawQuestions)) return { questions, correctIndices }
  rawQuestions.forEach((q, idx) => {
    const m = migrateQuizQuestion(q, idx) as QuizQuestionDraft
    if (m.questionType === 'mcq') {
      questions.push({ id: m.id, question: m.title, options: m.options.map((o) => String(o ?? '')) })
      correctIndices.push(Math.max(0, Math.min(m.correctOptionIndex, m.options.length - 1)))
    } else if (m.questionType === 'true_false') {
      questions.push({ id: m.id, question: m.title, options: ['True', 'False'] })
      correctIndices.push(m.tfCorrect ? 0 : 1)
    }
  })
  return { questions, correctIndices }
}

function StudentAdditionalCurriculumQuiz({
  curriculum,
  quizTitle,
  dueDate,
  courseId,
  onRecorded,
  enrollment,
  onToast,
  flatQuiz,
}: {
  curriculum: unknown
  quizTitle: string
  dueDate?: string
  courseId?: string
  onRecorded?: () => void | Promise<void>
  enrollment?: EnrollmentItem | null
  onToast?: (message: string, tone?: 'success' | 'info') => void
  flatQuiz?: { quizQuestions?: unknown[]; quizSettings?: unknown }
}) {
  const fromCurriculum = findCurriculumQuizTopic(curriculum, quizTitle)
  const flatQs = flatQuiz?.quizQuestions
  const useFlat =
    Array.isArray(flatQs) &&
    flatQs.length > 0 &&
    (!fromCurriculum ||
      !Array.isArray(fromCurriculum.quizQuestions) ||
      fromCurriculum.quizQuestions.length === 0)
  const passPercent = useFlat
    ? passingGradePercentFromQuizSettings(flatQuiz?.quizSettings)
    : (fromCurriculum?.passPercent ?? ADDITIONAL_QUIZ_DEFAULT_PASS)
  const rawQuestions = useFlat ? flatQs! : (fromCurriculum?.quizQuestions ?? [])
  const { questions, correctIndices } = buildAdditionalQuizPlayerPayload(rawQuestions)
  const att = useMemo(() => {
    const k = quizTitle.trim().toLowerCase()
    return enrollment?.curriculumQuizAttempts?.find((a) => String(a.quizTitle || '').trim().toLowerCase() === k) ?? null
  }, [enrollment?.curriculumQuizAttempts, quizTitle])
  const maxA = typeof att?.attemptsMax === 'number' ? att.attemptsMax : 2
  const used = typeof att?.attempts === 'number' ? att.attempts : 0
  const passedSaved = att?.passed === true
  const exhausted = used >= maxA
  const serverLocked = exhausted

  const [selections, setSelections] = useState<number[]>([])
  const [resultMsg, setResultMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [syncWarn, setSyncWarn] = useState<string | null>(null)
  const [localFreeze, setLocalFreeze] = useState<{ selections: number[]; text: string } | null>(null)

  useEffect(() => {
    const ai = att?.answerIndices
    const n = questions.length
    if (n === 0) return

    if (exhausted) {
      if (Array.isArray(ai) && ai.length === n) {
        setSelections(ai.map((x) => (typeof x === 'number' ? x : -1)))
      } else {
        setSelections(Array(n).fill(-1))
      }
      setLocalFreeze(null)
      setResultMsg(null)
      return
    }

    if (used > 0 && Array.isArray(ai) && ai.length === n) {
      const sel = ai.map((x) => (typeof x === 'number' ? x : -1))
      setSelections(sel)
      setLocalFreeze({
        selections: [...sel],
        text: passedSaved
          ? 'Your last submitted answers are shown below. You have already passed; use Retake quiz if you want another attempt.'
          : 'Your last submitted answers are shown below. Use Retake quiz when you are ready for another attempt.',
      })
      setResultMsg(null)
      return
    }

    setSelections(Array(n).fill(-1))
    setLocalFreeze(null)
    setResultMsg(null)
  }, [questions.length, quizTitle, passedSaved, used, maxA, exhausted, att?.answerIndices])

  const inputsLocked = serverLocked || !!localFreeze
  const displaySelections = localFreeze ? localFreeze.selections : selections
  const showRetakeQuiz = !!localFreeze && !serverLocked && used < maxA

  const submit = async () => {
    if (selections.length === 0) return
    if (selections.some((i) => i < 0)) {
      setResultMsg({ type: 'err', text: 'Please answer every question.' })
      return
    }
    setResultMsg(null)
    setSyncWarn(null)
    let correct = 0
    for (let i = 0; i < questions.length; i++) {
      if (selections[i] === correctIndices[i]) correct += 1
    }
    const pct = questions.length ? Math.round((100 * correct) / questions.length) : 0
    const passed = pct >= passPercent
    const msgText = passed
      ? `You passed with ${pct}% (required ${passPercent}%).`
      : `You scored ${pct}%. You need at least ${passPercent}% to pass.`
    setResultMsg(passed ? { type: 'ok', text: msgText } : { type: 'info', text: msgText })
    if (courseId) {
      try {
        await enrollmentService.submitCurriculumQuizResult(courseId, {
          quizTitle,
          passed,
          scorePercent: pct,
          answers: selections,
        })
        await onRecorded?.()
        if (passed && !passedSaved) {
          onToast?.('Your certificate will be emailed to you when your program sends it.', 'success')
        }
        const nextUsed = used + 1
        if (nextUsed < maxA) {
          setLocalFreeze({ selections: [...selections], text: msgText })
        } else {
          setLocalFreeze(null)
        }
      } catch (err: unknown) {
        const ax = err as { response?: { status?: number; data?: { error?: string; code?: string } } }
        const d = ax.response?.data
        if (ax.response?.status === 400 && d?.code === 'max_quiz_attempts') {
          setSyncWarn(d.error || 'Maximum attempts reached for this quiz.')
          await onRecorded?.()
        } else {
          setSyncWarn('Could not save this attempt right now. Your score is shown here only until it syncs.')
        }
      }
    } else {
      if (!passed) {
        setLocalFreeze({ selections: [...selections], text: msgText })
      }
    }
  }

  const hasCurriculumTopic = fromCurriculum != null
  const hasFlatQuestions = Array.isArray(flatQs) && flatQs.length > 0
  if (!hasCurriculumTopic && !hasFlatQuestions) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        No quiz content is available for &quot;{quizTitle}&quot; yet. Add a <strong>Quiz</strong> topic in the course curriculum with this
        title, or open <strong>Manage Training → Quizzes</strong> and use <strong>Questions &amp; settings</strong> for this quiz row.
      </p>
    )
  }

  if (questions.length === 0) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        This quiz has no multiple-choice or true/false questions yet. Open the course in admin, find the <strong>Quiz</strong> topic
        named &quot;{quizTitle}&quot;, and add at least one such question.
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-brand-navy/15 bg-[#f8fafc] p-4">
      <div>
        <h4 className="text-base font-semibold text-brand-navy">{quizTitle}</h4>
        {dueDate && <p className="text-xs text-slate-gray">Due: {dueDate}</p>}
        <p className="mt-1 text-sm text-slate-gray">Passing score: {passPercent}%</p>
        <p className="mt-1 text-xs text-slate-500">
          Attempts: {used}/{maxA}
          {exhausted ? ' — no further attempts.' : passedSaved ? ' — passed (you may still retake until attempts are used).' : ''}
        </p>
      </div>
      {syncWarn && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{syncWarn}</p>
      )}
      {localFreeze && (
        <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{localFreeze.text}</p>
      )}
      {resultMsg && !localFreeze && (
        <p
          className={
            resultMsg.type === 'ok'
              ? 'text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2'
              : resultMsg.type === 'err'
                ? 'text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2'
                : 'text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2'
          }
        >
          {resultMsg.text}
        </p>
      )}
      <ol className="space-y-4">
        {questions.map((q, qi) => (
          <li key={q.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="font-medium text-gray-900 text-sm">
              {qi + 1}. {q.question}
            </p>
            <div className="mt-2 space-y-1.5">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex items-start gap-2 text-sm ${inputsLocked ? 'text-gray-600 cursor-default' : 'text-gray-700 cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name={`addq-${quizTitle}-${q.id}`}
                    className="mt-0.5"
                    disabled={inputsLocked}
                    checked={displaySelections[qi] === oi}
                    onChange={() => {
                      if (inputsLocked) return
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
      {inputsLocked && (
        <p className="text-xs text-slate-600">Answers are locked after submit (or when this quiz is marked done).</p>
      )}
      {showRetakeQuiz ? (
        <button
          type="button"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          onClick={() => {
            setLocalFreeze(null)
            setSelections(Array(questions.length).fill(-1))
            setResultMsg(null)
          }}
        >
          Retake quiz (attempt {used + 1} of {maxA})
        </button>
      ) : null}
      {!inputsLocked ? (
        <button
          type="button"
          disabled={questions.length === 0}
          onClick={() => void submit()}
          className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
        >
          Submit quiz
        </button>
      ) : null}
    </div>
  )
}

function completionQuizCopy(slug: string | undefined, explicitTitle?: string) {
  if ((explicitTitle || '').trim()) {
    const t = (explicitTitle || '').trim()
    return {
      title: t,
      passedTitle: `You have passed ${t}.`,
      intro: 'Pass with at least {pct}% to be eligible for your certificate of completion.',
    }
  }
  const s = (slug || '').toLowerCase()
  if (s === 'demo-java-programming-seed') {
    return {
      title: 'Java completion quiz',
      passedTitle: 'You have passed the Java completion quiz.',
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
  completionLabel,
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
  certificateEmailOnly,
  onToast,
  enrollmentAttemptSync,
  pythonQuizAttemptsUsed,
  pythonQuizAttemptsMax,
}: {
  courseId: string
  courseSlug?: string
  /** Shown in headings when the course uses curriculum completionQuizTitle. */
  completionLabel?: string
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
  certificateEmailOnly?: boolean
  onToast?: (message: string, tone?: 'success' | 'info') => void
  /** Bumps when enrollment quiz attempts change so we reload read-only state. */
  enrollmentAttemptSync?: number
  /** From enrollment while passed (retake cap). */
  pythonQuizAttemptsUsed?: number
  pythonQuizAttemptsMax?: number
}) {
  const copy = completionQuizCopy(courseSlug, completionLabel)
  const noPdfDownload = !!certificateEmailOnly
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
  const [serverReadOnly, setServerReadOnly] = useState(false)
  const [attemptsMax, setAttemptsMax] = useState(2)
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [localFreeze, setLocalFreeze] = useState<{ selections: number[]; msg: string } | null>(null)
  const [retakeMode, setRetakeMode] = useState(false)

  useEffect(() => {
    if (!passed) setRetakeMode(false)
  }, [passed])

  useEffect(() => {
    if (passed && !retakeMode) {
      setLoading(false)
      setLocalFreeze(null)
      return
    }
    setLoading(true)
    setBanner(null)
    setLocalFreeze(null)
    courseService
      .getPythonQuiz(courseId)
      .then((d) => {
        setQuestions(d.questions)
        setPassPercent(d.passPercent)
        const max = typeof d.attemptsMax === 'number' ? d.attemptsMax : 2
        const used = typeof d.attemptsUsed === 'number' ? d.attemptsUsed : 0
        setAttemptsMax(max)
        setAttemptsUsed(used)
        setServerReadOnly(!!d.readOnly)
        const n = d.questions.length
        const last = Array.isArray(d.lastAnswerIndices) ? d.lastAnswerIndices : []
        if (d.readOnly && last.length === n) {
          setSelections(last.map((i) => (typeof i === 'number' ? i : -1)))
        } else {
          setSelections(Array(n).fill(-1))
        }
      })
      .catch(() => setBanner('Could not load the quiz. Try again later.'))
      .finally(() => setLoading(false))
  }, [courseId, passed, retakeMode, enrollmentAttemptSync])

  const inputsLocked = serverReadOnly || !!localFreeze
  const showRetakeQuiz = !!localFreeze && !serverReadOnly && attemptsUsed < attemptsMax

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
        const wasRetake = retakeMode
        await onUpdate()
        setBanner(null)
        setLocalFreeze(null)
        if (wasRetake) {
          setRetakeMode(false)
        }
        if (noPdfDownload && !wasRetake && !res.retakeAfterPass) {
          onToast?.('Your certificate will be emailed to your registered address.', 'success')
        }
        if (res.retakeAfterPass) {
          onToast?.('Retake submitted. Your pass is already on file.', 'info')
        }
      } else {
        const msg = res.message || `You scored ${res.scorePercent}%. You need ${res.passPercent}% to pass.`
        const used = typeof res.attemptsUsed === 'number' ? res.attemptsUsed : attemptsUsed + 1
        const max = typeof res.attemptsMax === 'number' ? res.attemptsMax : attemptsMax
        setAttemptsUsed(used)
        if (used >= max) {
          setServerReadOnly(true)
          setLocalFreeze(null)
          setBanner(res.hadPassRecorded ? `${msg} Your pass from an earlier attempt still counts.` : msg)
        } else {
          setLocalFreeze({
            selections: [...selections],
            msg: res.hadPassRecorded ? `${msg} Your pass from an earlier attempt still counts.` : msg,
          })
        }
        await onUpdate()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { error?: string; code?: string } } }
      const st = ax.response?.status
      const data = ax.response?.data
      if (st === 400 && data?.code === 'max_quiz_attempts') {
        setBanner(data.error || 'Maximum quiz attempts reached.')
        setServerReadOnly(true)
        setLocalFreeze(null)
        await onUpdate()
      } else {
        setBanner(data?.error || 'Submission failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (passed && !retakeMode) {
    const pqUsed = typeof pythonQuizAttemptsUsed === 'number' ? pythonQuizAttemptsUsed : 0
    const pqMax = typeof pythonQuizAttemptsMax === 'number' ? pythonQuizAttemptsMax : attemptsMax
    const canRetakeCompletion = pqUsed < pqMax
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 space-y-4">
        <div>
          <p className="font-semibold">{copy.passedTitle}</p>
          {score != null && <p className="mt-1 text-sm">Your score: {score}%</p>}
          <p className="mt-1 text-xs text-emerald-800/90">
            Quiz attempts used: {pqUsed}/{pqMax}.
            {canRetakeCompletion
              ? ' You may retake for practice until attempts are used.'
              : ' No quiz attempts remaining.'}
          </p>
        </div>
        <p className="text-sm leading-relaxed text-emerald-950 bg-white/70 border border-emerald-100 rounded-lg px-3 py-2.5">
          {noPdfDownload
            ? 'You have met the pass criteria. Your certificate of completion will be emailed to your registered address.'
            : 'Thank you for taking the quiz. Your certificate of completion has been sent to your registered email address.'}
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
        {!noPdfDownload && onGenerateCertificate && downloadsLeft > 0 ? (
          <button
            type="button"
            disabled={certBusy}
            onClick={onGenerateCertificate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {certBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {certificateIssued ? 'Generate certificate again' : 'Generate certificate (PDF)'}
          </button>
        ) : !noPdfDownload && onGenerateCertificate && downloadsLeft <= 0 ? (
          <p className="text-sm text-emerald-900">
            You have used all {CERTIFICATE_PDF_DOWNLOAD_LIMIT} certificate generations for this course. Use the copies
            from your email, or contact support if you need help.
          </p>
        ) : null}
        {!noPdfDownload ? (
          <p className="text-xs text-emerald-800/90">
            You can generate the certificate PDF at most {CERTIFICATE_PDF_DOWNLOAD_LIMIT} times. Each successful generation
            downloads the PDF and emails a copy to your registered address.
          </p>
        ) : null}
        {!noPdfDownload && downloadsLeft > 0 && downloadsLeft < CERTIFICATE_PDF_DOWNLOAD_LIMIT ? (
          <p className="text-xs font-medium text-emerald-900">
            Generations remaining: {downloadsLeft}
          </p>
        ) : null}
        {canRetakeCompletion ? (
          <button
            type="button"
            onClick={() => setRetakeMode(true)}
            className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-emerald-50"
          >
            Retake quiz
          </button>
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

  const displaySelections = localFreeze ? localFreeze.selections : selections

  return (
    <div className="space-y-4 rounded-xl border border-brand-navy/15 bg-[#f8fafc] p-4">
      <div>
        <h3 className="text-lg font-semibold text-brand-navy">{copy.title}</h3>
        <p className="mt-1 text-sm text-slate-gray">{copy.intro.replace('{pct}', String(passPercent))}</p>
        {retakeMode && passed ? (
          <p className="mt-2 text-sm text-slate-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            You have already passed. This attempt is optional practice; your recorded pass stays on file.
          </p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">
          Attempts: {attemptsUsed}/{attemptsMax}
          {serverReadOnly ? ' — no further attempts.' : ''}
        </p>
      </div>
      {localFreeze && (
        <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{localFreeze.msg}</p>
      )}
      {banner && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{banner}</p>}
      <ol className={`space-y-6 ${inputsLocked ? 'opacity-95' : ''}`}>
        {questions.map((q, qi) => (
          <li key={q.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="font-medium text-gray-900">
              {qi + 1}. {q.question}
            </p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex items-start gap-2 text-sm ${
                    inputsLocked ? 'text-gray-600 cursor-default' : 'text-gray-700 cursor-pointer'
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    className="mt-1"
                    disabled={inputsLocked}
                    checked={displaySelections[qi] === oi}
                    onChange={() => {
                      if (inputsLocked) return
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
      {inputsLocked && (
        <p className="text-xs text-slate-600">Submitted answers are shown above. You cannot change selections in this state.</p>
      )}
      {showRetakeQuiz ? (
        <button
          type="button"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          onClick={() => {
            setLocalFreeze(null)
            setSelections(Array(questions.length).fill(-1))
            setBanner(null)
          }}
        >
          Retake quiz (attempt {attemptsUsed + 1} of {attemptsMax})
        </button>
      ) : null}
      {!inputsLocked ? (
        <button
          type="button"
          disabled={submitting || questions.length === 0}
          onClick={() => void submit()}
          className="rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit quiz'}
        </button>
      ) : null}
    </div>
  )
}

function assignmentStableId(a: { id?: string }, index: number): string {
  return a.id?.trim() ? String(a.id) : `idx_${index}`
}

function AssignmentTurnInCard({
  courseId,
  assignmentId,
  title,
  dueDate,
  description,
  existing,
  onUpdated,
}: {
  courseId: string
  assignmentId: string
  title: string
  dueDate?: string
  description?: string
  existing?: AssignmentSubmissionItem
  onUpdated: () => void | Promise<void>
}) {
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!note.trim() && !file) {
      setMsg({ type: 'err', text: 'Add a note and/or choose a file to upload.' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await enrollmentService.submitAssignment(courseId, {
        assignmentId,
        note: note.trim() || undefined,
        file,
      })
      setNote('')
      setFile(null)
      setMsg({ type: 'ok', text: 'Your submission was saved.' })
      await onUpdated()
    } catch (err: unknown) {
      const raw =
        err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object'
          && 'data' in err.response
          ? String((err.response as { data?: { error?: string } }).data?.error ?? 'Upload failed')
          : 'Upload failed'
      setMsg({ type: 'err', text: raw })
    } finally {
      setBusy(false)
    }
  }

  const downloadMine = async () => {
    const fn = existing?.fileStorageName?.trim()
    if (!fn) return
    try {
      const blob = await enrollmentService.downloadSubmissionFile(fn)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = existing?.originalFileName?.trim() || 'submission'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setMsg({ type: 'err', text: 'Could not download your file. Try again.' })
    }
  }

  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <p className="font-medium text-gray-800">{title}</p>
      {dueDate ? <p className="text-xs text-slate-gray">Due: {dueDate}</p> : null}
      {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
      {existing?.submittedAt ? (
        <p className="mt-2 text-xs font-medium text-emerald-800">
          Submitted {existing.submittedAt.replace('T', ' ').replace('Z', ' UTC')}
        </p>
      ) : null}
      {existing?.text ? (
        <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100 rounded-md bg-gray-50 p-2">
          {existing.text}
        </p>
      ) : null}
      {existing?.fileStorageName ? (
        <button
          type="button"
          onClick={() => void downloadMine()}
          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> Download your file
        </button>
      ) : null}
      <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
        <label className="block text-xs font-medium text-gray-600">Add or replace submission</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Short note or answer text (optional if you attach a file)"
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="file"
          accept=".pdf,.doc,.docx,.zip,.jpg,.jpeg,.png,.txt,application/pdf,application/zip,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-gray-600"
        />
        {file ? <p className="text-xs text-slate-600 truncate">Selected: {file.name}</p> : null}
        {msg ? (
          <p className={`text-xs ${msg.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`} role="status">
            {msg.text}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
            </span>
          ) : (
            'Submit'
          )}
        </button>
      </form>
    </div>
  )
}

export function CourseContent() {
  const { id: courseId } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [course, setCourse] = useState<CourseContent | null>(null)
  const [enrollment, setEnrollment] = useState<EnrollmentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('overview')

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t !== 'certificate') return
    setActiveTab('certificate')
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('tab')
        return n
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams])
  const [certBusy, setCertBusy] = useState(false)
  const [certMessage, setCertMessage] = useState<string | null>(null)
  const [certMessageTone, setCertMessageTone] = useState<'success' | 'error' | 'info'>('success')
  const [openAdditionalQuizTitle, setOpenAdditionalQuizTitle] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'info' } | null>(null)
  const [attendanceOverview, setAttendanceOverview] = useState<{
    sessions: Array<{ sessionKey: string; title: string; sessionDate: string; time: string; platform: string; status: string; note: string }>
    summary: { markedSessions: number; attended: number; percent: number | null }
  } | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(t)
  }, [toast])

  const showToast = useCallback((message: string, tone: 'success' | 'info' = 'success') => {
    setToast({ message, tone })
  }, [])

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

  useEffect(() => {
    if (!courseId || activeTab !== 'attendance') return
    setAttendanceLoading(true)
    enrollmentService
      .getAttendanceForCourse(courseId)
      .then(setAttendanceOverview)
      .catch(() => setAttendanceOverview(null))
      .finally(() => setAttendanceLoading(false))
  }, [courseId, activeTab])

  useEffect(() => {
    setOpenAdditionalQuizTitle(null)
  }, [courseId])

  const additionalQuizRows = useMemo(
    () => buildAdditionalQuizList(course?.curriculum, course?.quizzes),
    [course?.curriculum, course?.quizzes],
  )
  const additionalQuizModuleGroups = useMemo(
    () => buildQuizModuleGroups(course?.curriculum, additionalQuizRows, (course?.completionQuizTitle || '').trim()),
    [course?.curriculum, additionalQuizRows, course?.completionQuizTitle],
  )
  const quizProgress = useMemo(() => computeQuizProgress(course, enrollment), [course, enrollment])

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
        setCertMessage('Your certificate PDF has started downloading. A copy is also being sent to your email.')
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
    <>
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
                              {!gated && isLecture && (topic.lessonExerciseFileName || topic.lessonVideoFileName) ? (
                                <div className="mt-3 space-y-2">
                                  <p className="text-xs font-semibold text-gray-700">Attachments</p>
                                  <ul className="space-y-1">
                                    {topic.lessonExerciseFileName ? (
                                      <li>
                                        <a
                                          href={materialDownloadHref(`api/courses/media/lesson/${topic.lessonExerciseFileName}`)}
                                          className="inline-flex items-center gap-1 text-sm text-brand-accent hover:underline"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <Download className="h-3.5 w-3.5" /> Exercise / handout
                                        </a>
                                      </li>
                                    ) : null}
                                    {topic.lessonVideoFileName ? (
                                      <li>
                                        <a
                                          href={materialDownloadHref(`api/courses/media/lesson/${topic.lessonVideoFileName}`)}
                                          className="inline-flex items-center gap-1 text-sm text-brand-accent hover:underline"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <Download className="h-3.5 w-3.5" /> Lesson video file
                                        </a>
                                      </li>
                                    ) : null}
                                  </ul>
                                </div>
                              ) : null}
                              {!gated && isQuiz ? (
                                <div className="mt-3 space-y-2">
                                  {Array.isArray(topic.quizQuestions) && topic.quizQuestions.length > 0 ? (
                                    <>
                                      <p className="text-sm text-gray-700">This lesson includes a quiz ({topic.quizQuestions.length} questions).</p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const qt = title.trim()
                                          setActiveTab('quizzes')
                                          window.setTimeout(() => setOpenAdditionalQuizTitle(qt), 0)
                                        }}
                                        className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
                                      >
                                        Attempt quiz
                                      </button>
                                    </>
                                  ) : (
                                    <p className="text-xs leading-relaxed text-slate-600">
                                      This topic is a <strong>curriculum quiz</strong>. Open the <strong>Quizzes</strong> tab when your trainer has published questions.
                                    </p>
                                  )}
                                </div>
                              ) : null}
                              {!gated && topic.type === 'Assignment' ? (
                                <div className="mt-3 space-y-3">
                                  {topic.assignment?.instructions ? (
                                    <div
                                      className="prose prose-sm prose-slate max-w-none text-gray-700 [&_a]:text-brand-accent"
                                      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(topic.assignment.instructions) }}
                                    />
                                  ) : null}
                                  <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                                    {topic.assignment?.deadline ? <span>Due: {topic.assignment.deadline}</span> : null}
                                    {topic.assignment?.maxMarks ? <span>Max marks: {topic.assignment.maxMarks}</span> : null}
                                  </div>
                                  {Array.isArray(topic.assignment?.questions) && (topic.assignment?.questions?.length ?? 0) > 0 ? (
                                    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Questions</p>
                                      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-gray-800">
                                        {(topic.assignment?.questions ?? []).map((q, qi) =>
                                          q?.prompt?.trim() ? <li key={qi}>{q.prompt}</li> : null,
                                        )}
                                      </ol>
                                    </div>
                                  ) : null}
                                  {Array.isArray(topic.assignment?.attachments) &&
                                  (topic.assignment?.attachments ?? []).some((x) => String(x?.url || '').trim()) ? (
                                    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Attachments</p>
                                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                                        {(topic.assignment?.attachments ?? []).map((att, ai) => {
                                          const url = String(att?.url || '').trim()
                                          const name = String(att?.name || '').trim() || url || 'Link'
                                          if (!url) return null
                                          return (
                                            <li key={ai}>
                                              <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-brand-accent hover:underline"
                                              >
                                                {name}
                                              </a>
                                            </li>
                                          )
                                        })}
                                      </ul>
                                    </div>
                                  ) : null}
                                  {(() => {
                                    const match = findMatchingFlatAssignment(course, title, topic.assignment)
                                    if (!match || !courseId) {
                                      return (
                                        <p className="text-xs text-amber-800">
                                          Your trainer will link this lesson to a course assignment for uploads. You can also use the Assignments tab.
                                        </p>
                                      )
                                    }
                                    const existing = enrollment?.assignmentSubmissions?.find((s) => s.assignmentId === match.id)
                                    return (
                                      <AssignmentTurnInCard
                                        courseId={courseId}
                                        assignmentId={match.id}
                                        title={match.title}
                                        dueDate={match.dueDate}
                                        description={match.description}
                                        existing={existing}
                                        onUpdated={() => void refreshEnrollment()}
                                      />
                                    )
                                  })()}
                                </div>
                              ) : null}
                              {!gated && topic.id ? (
                                <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                                  <input
                                    type="checkbox"
                                    className="rounded border-gray-300"
                                    checked={enrollment?.completedCurriculumTopicIds?.includes(topic.id) ?? false}
                                    onChange={(e) => {
                                      if (!courseId || !topic.id) return
                                      void enrollmentService
                                        .setCurriculumTopicComplete(courseId, topic.id, e.target.checked)
                                        .then(setEnrollment)
                                        .catch(() => showToast('Could not update progress', 'info'))
                                    }}
                                  />
                                  Mark this lesson as complete
                                </label>
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
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-gray">
              Attendance for your class sessions. Status appears after your trainer saves attendance for a session.
            </p>
            {attendanceLoading ? (
              <p className="text-sm inline-flex items-center gap-2 text-slate-gray">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : attendanceOverview && attendanceOverview.summary.markedSessions > 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                <span className="font-semibold">
                  {attendanceOverview.summary.attended} / {attendanceOverview.summary.markedSessions} sessions attended
                </span>
                {attendanceOverview.summary.percent != null ? (
                  <span className="ml-2">({attendanceOverview.summary.percent}%)</span>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-gray">No marked sessions yet. Check back after your trainer records attendance.</p>
            )}
            {attendanceOverview && attendanceOverview.sessions.length > 0 ? (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                {attendanceOverview.sessions.map((s) => (
                  <li key={s.sessionKey} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{s.title}</p>
                      <p className="text-xs text-slate-gray">
                        {s.sessionDate} {s.time} · {s.platform}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium capitalize ${
                        s.status === 'present' || s.status === 'late'
                          ? 'text-emerald-700'
                          : s.status === 'absent'
                            ? 'text-red-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {s.status === 'not_marked' ? 'Not marked' : s.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        {activeTab === 'class-links' && (
          <div className="space-y-3">
            {(!course.classLinks || course.classLinks.length === 0) ? (
              <p className="text-slate-gray">No class links yet.</p>
            ) : (
              course.classLinks.map((cl, i) => {
                const yt = classLinkIsYoutube(cl)
                return (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 p-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {yt ? (
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-xs font-bold text-white" aria-hidden>
                        ▶
                      </span>
                    ) : null}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800">{cl.title || 'Session'}</p>
                      <p className="text-xs text-slate-gray">{cl.date} {cl.time} · {cl.platform}</p>
                    </div>
                  </div>
                  {cl.link && (
                    <a
                      href={cl.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white hover:opacity-95 shrink-0 ${
                        yt ? 'bg-red-600' : 'bg-brand-accent hover:bg-primary-600'
                      }`}
                    >
                      {yt ? 'Watch on YouTube' : 'Join'} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                )
              })
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
              course.assignments.map((a, i) => {
                const aid = assignmentStableId(a, i)
                const existing = enrollment?.assignmentSubmissions?.find((s) => s.assignmentId === aid)
                return (
                  <AssignmentTurnInCard
                    key={aid}
                    courseId={courseId!}
                    assignmentId={aid}
                    title={a.title || `Assignment ${i + 1}`}
                    dueDate={a.dueDate}
                    description={a.description}
                    existing={existing}
                    onUpdated={() => void refreshEnrollment()}
                  />
                )
              })
            )}
          </div>
        )}
        {activeTab === 'quizzes' && (
          <div className="space-y-6">
            <QuizProgressSummary course={course} enrollment={enrollment} />
            {enrollment?.pythonQuizAvailable && courseId && (
              <PythonCourseQuizBlock
                courseId={courseId}
                courseSlug={course.slug}
                completionLabel={course.completionQuizTitle}
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
                  enrollment.pythonQuizPassed && !course.certificateEmailOnly
                    ? handleGenerateCertificate
                    : undefined
                }
                certificateEmailOnly={!!course.certificateEmailOnly}
                onToast={showToast}
                enrollmentAttemptSync={enrollment?.pythonQuizAttemptsUsed ?? 0}
                pythonQuizAttemptsUsed={enrollment?.pythonQuizAttemptsUsed}
                pythonQuizAttemptsMax={enrollment?.pythonQuizAttemptsMax}
              />
            )}
            {additionalQuizModuleGroups.length === 0 && !enrollment?.pythonQuizAvailable ? (
              <p className="text-slate-gray">No quizzes yet.</p>
            ) : null}
            {additionalQuizModuleGroups.length > 0 ? (
              <div className="space-y-6">
                {enrollment?.pythonQuizAvailable && (
                  <p className="text-sm font-medium text-brand-navy">Quizzes by module</p>
                )}
                {additionalQuizModuleGroups.map((g) => (
                  <div key={g.moduleTitle} className="space-y-3">
                    <p className="text-sm font-semibold text-slate-700 border-b border-gray-100 pb-1">{g.moduleTitle}</p>
                    {g.rows.map((q) => {
                      const t = (q.title || '').trim()
                      return (
                        <div key={`${g.moduleTitle}-${t}`} className="rounded-lg border border-gray-100 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-gray-800">{q.title}</p>
                              {q.dueDate && <p className="text-xs text-slate-gray">Due: {q.dueDate}</p>}
                            </div>
                            {openAdditionalQuizTitle !== t ? (
                              <button
                                type="button"
                                onClick={() => setOpenAdditionalQuizTitle(t)}
                                className="rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
                              >
                                Start Quiz
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setOpenAdditionalQuizTitle(null)}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Close
                              </button>
                            )}
                          </div>
                          {openAdditionalQuizTitle === t && t ? (
                            <StudentAdditionalCurriculumQuiz
                              curriculum={course.curriculum}
                              quizTitle={t}
                              dueDate={q.dueDate}
                              flatQuiz={q.flatQuiz}
                              courseId={courseId}
                              enrollment={enrollment}
                              onRecorded={refreshEnrollment}
                              onToast={showToast}
                            />
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : null}
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
            {quizProgress.allPassed && quizProgress.total > 0 ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 text-left">
                All quizzes for this course are complete. You will receive an email about your certificate when processing
                is complete.
              </p>
            ) : null}
            {enrollment?.pythonQuizAvailable ? (
              <>
                {!enrollment.pythonQuizPassed && (
                  <p className="font-medium text-gray-700">
                    Pass the <strong>{completionQuizCopy(course.slug, course.completionQuizTitle).title}</strong> in the{' '}
                    <strong>Quizzes</strong> tab
                    {course.certificateEmailOnly
                      ? '. Your certificate of completion will be sent by email (no in-app download for this program).'
                      : ', then use Generate certificate (PDF) there to download a copy; a copy is also emailed to you.'}
                  </p>
                )}
                {enrollment.pythonQuizPassed && (
                  <p className="font-medium text-gray-700">
                    {course.certificateEmailOnly
                      ? 'You have passed the completion quiz. Your certificate will be delivered by email to your registered address.'
                      : (
                          <>
                            You have passed the quiz. Open the <strong>Quizzes</strong> tab and use{' '}
                            <strong>Generate certificate (PDF)</strong> below your pass message to download and email your
                            certificate.
                          </>
                        )}
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
    {toast ? (
      <div
        role="status"
        className={`fixed bottom-6 right-6 z-[100] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
          toast.tone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        {toast.message}
      </div>
    ) : null}
    </>
  )
}
