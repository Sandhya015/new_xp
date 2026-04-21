/**
 * Admin — Add New Training (AD-WF-03). 3-step: Basics → Curriculum → Additional.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Library,
  ClipboardList,
  ClipboardCheck,
  BookOpen,
  Pencil,
} from 'lucide-react'
import { UNIVERSITIES_LIST } from '@/constants/universities'
import {
  BA_SUBJECTS,
  BBA_SUBJECTS,
  BCA_SUBJECTS,
  BCOM_SUBJECTS,
  BRANCH_OPTIONS,
  BSC_SUBJECTS,
  OTHER_BRANCH_VALUE,
  OTHER_COURSE_TOKEN,
  OTHER_UNIVERSITY_TOKEN,
} from '@/constants/trainingBranchesAndSubjects'
import {
  prepareFeaturedTrainingImage,
  validateFeaturedTrainingImageQuick,
} from '@/utils/featuredImageValidation'
import { adminService } from '@/services/adminService'
import { fetchApiHealth, invalidateCoursesListCache } from '@/services/courseService'
import { absoluteApiUrl } from '@/config/api'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import {
  QuizBuilderModal,
  type QuizTopicDraft,
  type QuizSettingsDraft,
  defaultQuizSettings,
} from '@/components/admin/QuizBuilderModal'
import {
  AssignmentBuilderModal,
  defaultAssignmentDraft,
  type AssignmentTopicDraft,
} from '@/components/admin/AssignmentBuilderModal'
import {
  LessonBuilderModal,
  type LessonTopicDraft,
  type LessonVideoAttachMode,
} from '@/components/admin/LessonBuilderModal'
import { migrateQuizQuestion, questionSummaryLine, type QuizQuestionDraft } from '@/components/admin/quizQuestionTypes'
import { plainTextFromHtml } from '@/utils/sanitizeHtml'
import { useAuthStore } from '@/store/authStore'

/** Topic type buttons order (stored values unchanged; backend accepts legacy types). */
const TOPIC_TYPE_ORDER = ['Lecture', 'Quiz', 'Assignment'] as const
type TopicType = (typeof TOPIC_TYPE_ORDER)[number]

/** Button labels aligned with Tutor-style wording; values stored unchanged. */
function topicTypeButtonLabel(t: TopicType): string {
  if (t === 'Lecture') return 'Lesson'
  if (t === 'Quiz') return 'Quiz'
  return 'Assignment'
}

/** Basename for hosted cover (`/api/courses/media/featured/<file>`). Not for external URLs. */
function featuredImageStoredBasename(pathOrUrl: string): string {
  const s = (pathOrUrl || '').trim()
  const marker = '/api/courses/media/featured/'
  const i = s.indexOf(marker)
  if (i < 0) return ''
  return (s.slice(i + marker.length).split(/[?#]/)[0] ?? '').trim()
}

interface CurriculumTopic {
  id: string
  title: string
  type: TopicType
  details: string
  duration: string
  recordingFile: File | null
  recordingNote: string
  /** New topic card: title + summary only until confirmed (Tutor-style). */
  isCurriculumDraft?: boolean
  /** Quiz-only: typed questions (MCQ, T/F, short answer, fill-in-blank). */
  quizQuestions?: QuizQuestionDraft[]
  /** Quiz-only: Tutor-style timing, attempts, layout, etc. */
  quizSettings?: QuizSettingsDraft
  /** Assignment-only: submission rules and deadlines. */
  assignment?: AssignmentTopicDraft
  /** Lecture-only: rich HTML from lesson builder */
  lessonContent?: string
  lessonVideoAttachMode?: LessonVideoAttachMode
  lessonVideoUrl?: string
  /** `__module__` or another topic id (Recording) */
  lessonVideoRecordingRef?: string | null
  lessonVideoHours?: string
  lessonVideoMinutes?: string
  lessonVideoSeconds?: string
  lessonFeaturedImageFile?: File | null
  lessonVideoFile?: File | null
  lessonExerciseFile?: File | null
  lessonPreviewEnabled?: boolean
}

interface CurriculumModule {
  id: string
  title: string
  order: number
  topics: CurriculumTopic[]
  recordingFile: File | null
}

function lessonVideoAttachModeFromTopic(t: CurriculumTopic): LessonVideoAttachMode {
  if (t.lessonVideoFile) return 'file'
  if (t.lessonVideoUrl?.trim()) return 'url'
  return 'none'
}

/** Lines shown under a Lecture topic after the lesson builder has saved data. */
function buildLessonPreviewLines(topic: CurriculumTopic): string[] {
  const lines: string[] = []
  const rawHtml = (topic.lessonContent || '').trim()
  const text = plainTextFromHtml(rawHtml).trim()
  if (text) {
    lines.push(text.length > 140 ? `${text.slice(0, 140)}…` : text)
  } else if (rawHtml) {
    const withoutEmptyShell = rawHtml
      .replace(/<\/?p\b[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, '')
      .replace(/\s/g, '')
      .trim()
    if (withoutEmptyShell.length > 0) {
      lines.push('Lesson body: rich HTML saved (no plain-text excerpt from current markup)')
    }
  }
  const mode = lessonVideoAttachModeFromTopic(topic)
  if (mode === 'url' && topic.lessonVideoUrl?.trim()) {
    const u = topic.lessonVideoUrl.trim()
    lines.push(`Video URL: ${u.length > 72 ? `${u.slice(0, 72)}…` : u}`)
  }
  if (mode === 'file' && topic.lessonVideoFile) {
    lines.push(`Video file: ${topic.lessonVideoFile.name}`)
  }
  if (topic.lessonFeaturedImageFile) {
    lines.push(`Featured image: ${topic.lessonFeaturedImageFile.name}`)
  }
  if (topic.lessonExerciseFile) {
    lines.push(`Exercise / attachment: ${topic.lessonExerciseFile.name}`)
  }
  if (topic.lessonPreviewEnabled) {
    lines.push('Learner preview: enabled')
  }
  return lines
}

const CATEGORIES = ['Technical', 'Non-Technical']
const COURSE_OPTIONS: { value: string; label: string }[] = [
  { value: 'B.Tech', label: 'B.Tech' },
  { value: 'Diploma', label: 'Diploma' },
  { value: 'BA', label: 'BA' },
  { value: 'BSc', label: 'BSc' },
  { value: 'BCom', label: 'BCom' },
  { value: 'BBA', label: 'BBA' },
  { value: 'BCA', label: 'BCA' },
  { value: OTHER_COURSE_TOKEN, label: 'Other' },
]
const MODES = ['Online', 'Offline', 'Hybrid']
const DIFFICULTY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Advanced', label: 'Advanced' },
]

type SubjectKey = 'BSc' | 'BCom' | 'BA' | 'BBA' | 'BCA'
const EMPTY_SUBJECT_PICKS: Record<SubjectKey, string[]> = {
  BSc: [],
  BCom: [],
  BA: [],
  BBA: [],
  BCA: [],
}

const SUBJECT_LIST_BY_KEY: Record<SubjectKey, readonly string[]> = {
  BSc: BSC_SUBJECTS,
  BCom: BCOM_SUBJECTS,
  BA: BA_SUBJECTS,
  BBA: BBA_SUBJECTS,
  BCA: BCA_SUBJECTS,
}

function hasOnlyOtherCourse(courses: string[]): boolean {
  return courses.length === 1 && courses[0] === OTHER_COURSE_TOKEN
}

function needsBranchSection(courses: string[]): boolean {
  if (hasOnlyOtherCourse(courses)) return false
  return courses.some((c) => c === 'B.Tech' || c === 'Diploma')
}

function subjectKeysForCourses(courses: string[]): SubjectKey[] {
  const keys: SubjectKey[] = []
  if (courses.includes('BSc')) keys.push('BSc')
  if (courses.includes('BCom')) keys.push('BCom')
  if (courses.includes('BA')) keys.push('BA')
  if (courses.includes('BBA')) keys.push('BBA')
  if (courses.includes('BCA')) keys.push('BCA')
  return keys
}

function needsSubjectSection(courses: string[]): boolean {
  if (hasOnlyOtherCourse(courses)) return false
  return subjectKeysForCourses(courses).length > 0
}

function anySubjectOtherPicked(picks: Record<SubjectKey, string[]>): boolean {
  return (['BSc', 'BCom', 'BA', 'BBA', 'BCA'] as SubjectKey[]).some((k) => (picks[k] || []).includes('Other'))
}

function resolveUniversitiesPayload(unis: string[], other: string): string[] {
  const base = unis.filter((u) => u !== OTHER_UNIVERSITY_TOKEN)
  if (unis.includes(OTHER_UNIVERSITY_TOKEN) && other.trim()) base.push(other.trim())
  return base
}

function resolveCoursesPayload(courses: string[], other: string): string[] {
  const base = courses.filter((c) => c !== OTHER_COURSE_TOKEN)
  if (courses.includes(OTHER_COURSE_TOKEN) && other.trim()) base.push(other.trim())
  return base
}

function resolveBranchesPayload(branches: string[], other: string): string[] {
  const base = branches.filter((b) => b !== OTHER_BRANCH_VALUE)
  if (branches.includes(OTHER_BRANCH_VALUE) && other.trim()) base.push(other.trim())
  return base
}

function flattenSubjectsPayload(
  courses: string[],
  picks: Record<SubjectKey, string[]>,
  otherText: string,
): string[] {
  const out: string[] = []
  for (const k of subjectKeysForCourses(courses)) {
    for (const s of picks[k] || []) {
      if (s === 'Other') {
        const t = otherText.trim()
        if (t) out.push(t)
      } else if (s) {
        out.push(s)
      }
    }
  }
  return out
}

function toScheduledIso(dateStr: string, timeStr: string): string | undefined {
  const d0 = dateStr.trim()
  if (!d0) return undefined
  const t = (timeStr || '09:00').trim()
  const normalized = t.length === 5 ? `${t}:00` : t
  const d = new Date(`${d0}T${normalized}`)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function slugifyTitle(t: string) {
  return t
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

const UNIVERSITY_NAME_SET = new Set<string>(UNIVERSITIES_LIST.map((u) => u.name as string))
const COURSE_VALUE_SET = new Set<string>(COURSE_OPTIONS.map((o) => o.value))
const BRANCH_VALUE_SET = new Set<string>(BRANCH_OPTIONS as unknown as string[])

function splitUniversitiesFromApi(uv: unknown): { list: string[]; other: string } {
  const parts =
    typeof uv === 'string'
      ? uv.split(',').map((s) => s.trim()).filter(Boolean)
      : Array.isArray(uv)
        ? uv.map(String).map((s) => s.trim()).filter(Boolean)
        : []
  const picked: string[] = []
  const custom: string[] = []
  for (const u of parts) {
    if (UNIVERSITY_NAME_SET.has(u)) picked.push(u)
    else custom.push(u)
  }
  if (custom.length) return { list: [...picked, OTHER_UNIVERSITY_TOKEN], other: custom.join(', ') }
  return { list: picked, other: '' }
}

function splitCoursesFromApi(cs: unknown): { list: string[]; other: string } {
  const raw = Array.isArray(cs) ? cs.map(String).map((s) => s.trim()).filter(Boolean) : []
  const picked: string[] = []
  const custom: string[] = []
  for (const x of raw) {
    if (COURSE_VALUE_SET.has(x)) picked.push(x)
    else custom.push(x)
  }
  if (custom.length) return { list: [...picked, OTHER_COURSE_TOKEN], other: custom.join(', ') }
  return { list: picked, other: '' }
}

function splitBranchesFromApi(br: unknown): { list: string[]; other: string } {
  const raw = Array.isArray(br) ? br.map(String).map((s) => s.trim()).filter(Boolean) : []
  const picked: string[] = []
  const custom: string[] = []
  for (const x of raw) {
    if (BRANCH_VALUE_SET.has(x)) picked.push(x)
    else custom.push(x)
  }
  if (custom.length) return { list: [...picked, OTHER_BRANCH_VALUE], other: custom.join(', ') }
  return { list: picked, other: '' }
}

function modeArrayFromApi(m: unknown): string[] {
  if (Array.isArray(m)) return m.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof m === 'string' && m.trim()) return m.split(',').map((s) => s.trim()).filter(Boolean)
  return ['Online']
}

function categoryLabelFromApi(cat: unknown): string {
  const v = String(cat ?? '').toLowerCase()
  if (v === 'non-technical' || v === 'non_technical' || v === 'nontechnical') return 'Non-Technical'
  return 'Technical'
}

function scheduledPartsFromApi(iso: unknown): { enabled: boolean; date: string; time: string } {
  if (!iso || typeof iso !== 'string' || !iso.trim()) return { enabled: false, date: '', time: '09:00' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { enabled: false, date: '', time: '09:00' }
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return { enabled: true, date: `${y}-${mo}-${da}`, time: `${hh}:${mm}` }
}

function mapApiSubjectsToPicks(
  courses: string[],
  apiSubjects: unknown,
): { subjectPicks: Record<SubjectKey, string[]>; subjectOther: string } {
  const picks: Record<SubjectKey, string[]> = { ...EMPTY_SUBJECT_PICKS }
  const subs = Array.isArray(apiSubjects) ? apiSubjects.map(String).map((s) => s.trim()).filter(Boolean) : []
  const keys = subjectKeysForCourses(courses)
  const unmatched: string[] = []
  for (const s of subs) {
    let placed = false
    for (const k of keys) {
      const list = SUBJECT_LIST_BY_KEY[k] as readonly string[]
      if (list.includes(s)) {
        if (!picks[k].includes(s)) picks[k] = [...picks[k], s]
        placed = true
        break
      }
    }
    if (!placed) unmatched.push(s)
  }
  if (unmatched.length && keys.length > 0) {
    const k0 = keys[0]
    picks[k0] = [...(picks[k0] || []), 'Other']
    return { subjectPicks: picks, subjectOther: unmatched.join(', ') }
  }
  return { subjectPicks: picks, subjectOther: '' }
}

function asTopicType(raw: unknown): TopicType {
  const t = String(raw ?? 'Lecture')
  if (t === 'Quiz' || t === 'Assignment' || t === 'Lecture') return t
  return 'Lecture'
}

function mapApiTopicToCurriculumTopic(raw: unknown, topicIndex: number): CurriculumTopic {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const id = typeof r.id === 'string' && r.id.trim() ? r.id : `topic_${topicIndex}_${Date.now()}`
  const type = asTopicType(r.type)
  const base: CurriculumTopic = {
    id,
    title: String(r.title ?? ''),
    type,
    details: String(r.details ?? ''),
    duration: String(r.duration ?? ''),
    recordingFile: null,
    recordingNote: String(r.recordingNote ?? ''),
    isCurriculumDraft: false,
  }
  if (type === 'Lecture') {
    const modeRaw = String(r.lessonVideoAttachMode || 'none')
    const mode: LessonVideoAttachMode =
      modeRaw === 'file' || modeRaw === 'url' || modeRaw === 'none' ? modeRaw : 'none'
    return {
      ...base,
      lessonContent: String(r.lessonContent ?? ''),
      lessonVideoAttachMode: mode,
      lessonVideoUrl: String(r.lessonVideoUrl ?? ''),
      lessonVideoRecordingRef:
        r.lessonVideoRecordingRef != null && String(r.lessonVideoRecordingRef).trim()
          ? String(r.lessonVideoRecordingRef)
          : null,
      lessonVideoHours: String(r.lessonVideoHours ?? '0'),
      lessonVideoMinutes: String(r.lessonVideoMinutes ?? '0'),
      lessonVideoSeconds: String(r.lessonVideoSeconds ?? '0'),
      lessonPreviewEnabled: Boolean(r.lessonPreviewEnabled),
      lessonFeaturedImageFile: null,
      lessonVideoFile: null,
      lessonExerciseFile: null,
    }
  }
  if (type === 'Quiz') {
    const qqRaw = Array.isArray(r.quizQuestions) ? r.quizQuestions : []
    const quizQuestions = qqRaw.map((q, i) => migrateQuizQuestion(q, i))
    const qs = {
      ...defaultQuizSettings(),
      ...(typeof r.quizSettings === 'object' && r.quizSettings !== null ? (r.quizSettings as object) : {}),
    }
    return { ...base, quizQuestions, quizSettings: qs as QuizSettingsDraft }
  }
  if (type === 'Assignment') {
    const assignment = {
      ...defaultAssignmentDraft(),
      ...(typeof r.assignment === 'object' && r.assignment !== null ? (r.assignment as Partial<AssignmentTopicDraft>) : {}),
    }
    return { ...base, assignment }
  }
  return base
}

function mapApiCurriculumToState(raw: unknown): CurriculumModule[] {
  if (!Array.isArray(raw)) return []
  return raw.map((mod, mi) => {
    const m = mod && typeof mod === 'object' ? (mod as Record<string, unknown>) : {}
    const id = typeof m.id === 'string' && m.id.trim() ? m.id : `mod_${mi}`
    const topicsRaw = Array.isArray(m.topics) ? m.topics : []
    let order = typeof m.order === 'number' ? m.order : mi
    if (typeof m.order === 'string' && (m.order as string).trim()) {
      const n = parseInt(String(m.order), 10)
      if (!Number.isNaN(n)) order = n
    }
    return {
      id,
      title: String(m.title ?? ''),
      order,
      recordingFile: null,
      topics: topicsRaw.map((t, ti) => mapApiTopicToCurriculumTopic(t, ti)),
    }
  })
}

function listLines(arr: unknown): string {
  if (!Array.isArray(arr)) return ''
  return (arr as string[]).map((x) => String(x).trim()).filter(Boolean).join('\n')
}

function mapApiCourseToWizardState(c: Record<string, unknown>) {
  const uni = splitUniversitiesFromApi(c.universities)
  const crs = splitCoursesFromApi(c.courses)
  const br = splitBranchesFromApi(c.streams)
  const sp = mapApiSubjectsToPicks(crs.list, c.subjects)
  const sched = scheduledPartsFromApi(c.scheduledPublishAt)
  const price = typeof c.price === 'number' ? c.price : parseInt(String(c.price ?? '0'), 10) || 0
  const orig = typeof c.originalPrice === 'number' ? c.originalPrice : parseInt(String(c.originalPrice ?? '0'), 10) || 0
  const du = String(c.durationUnit ?? 'weeks').toLowerCase()
  const durationUnit = du === 'hours' ? 'hours' : 'weeks'
  const tms = c.trainingMaxSeats
  const trainingMaxSeatsStr =
    tms != null && String(tms).trim() !== '' && !Number.isNaN(Number(tms)) ? String(Number(tms)) : ''
  const tags = Array.isArray(c.trainingTags) ? (c.trainingTags as string[]).join(', ') : ''
  const durStr = String(c.duration ?? '').trim()
  const durMatch = durStr.match(/^(\d+)/)
  const durationFromDurationField = durMatch ? durMatch[1] : ''

  const basic = {
    title: String(c.title ?? ''),
    slug: String(c.slug ?? ''),
    category: categoryLabelFromApi(c.category),
    universities: uni.list,
    courses: crs.list,
    branches: br.list,
    mode: modeArrayFromApi(c.mode),
    durationValue: String(c.durationValue ?? '').trim() || durationFromDurationField,
    durationUnit,
    fee: price === 0 ? '' : String(price),
    originalPrice: orig > 0 ? String(orig) : '',
    pricingFree: price === 0,
    shortDesc: String(c.shortDescription ?? ''),
    fullDesc: String(c.fullDescription ?? c.description ?? ''),
    trainerName: String(c.trainerName ?? ''),
    difficulty: String(c.difficulty ?? 'all') || 'all',
    featuredImageUrl: String(c.featuredImageUrl ?? ''),
    introVideoUrl: String(c.introVideoUrl ?? ''),
    introVideoFile: null as File | null,
    thumbnail: null as File | null,
    listingVisibility: (String(c.listingVisibility ?? 'public').toLowerCase() === 'unlisted' ? 'unlisted' : 'public') as
      | 'public'
      | 'unlisted',
    scheduleEnabled: sched.enabled,
    scheduleDate: sched.date,
    scheduleTime: sched.time,
    trainingTags: tags,
  }

  const additional = {
    whatYouWillLearn: listLines(c.whatYouWillLearn),
    targetAudience: String(c.targetAudience ?? ''),
    materialsIncluded: listLines(c.materialsIncluded),
    instructions: String(c.instructions ?? ''),
    trainingStartDate: String(c.trainingStartDate ?? ''),
    trainingEndDate: String(c.trainingEndDate ?? ''),
    trainingMaxSeats: trainingMaxSeatsStr,
  }

  return {
    basic,
    universityOther: uni.other,
    courseOther: crs.other,
    branchOther: br.other,
    subjectOther: sp.subjectOther,
    subjectPicks: sp.subjectPicks,
    additional,
    curriculum: mapApiCurriculumToState(c.curriculum),
  }
}

export function AddTraining() {
  const navigate = useNavigate()
  const { id: editCourseId } = useParams<{ id?: string }>()
  const authUser = useAuthStore((s) => s.user)
  const slugTouched = useRef(false)
  const editDraftActiveRef = useRef(false)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [basic, setBasic] = useState({
    title: '',
    slug: '',
    category: '',
    universities: [] as string[],
    courses: [] as string[],
    branches: [] as string[],
    mode: [] as string[],
    durationValue: '',
    durationUnit: 'weeks',
    fee: '',
    originalPrice: '',
    pricingFree: false,
    shortDesc: '',
    fullDesc: '',
    trainerName: '',
    difficulty: 'all',
    featuredImageUrl: '',
    introVideoUrl: '',
    /** Optional MP4/MOV/AVI; uploaded on save (same API as intro `kind=intro`). If set, overrides pasted URL for storage. */
    introVideoFile: null as File | null,
    thumbnail: null as File | null,
    listingVisibility: 'public' as 'public' | 'unlisted',
    scheduleEnabled: false,
    scheduleDate: '',
    scheduleTime: '',
    trainingTags: '',
  })
  const [universityOther, setUniversityOther] = useState('')
  const [courseOther, setCourseOther] = useState('')
  const [branchOther, setBranchOther] = useState('')
  const [subjectOther, setSubjectOther] = useState('')
  const [subjectPicks, setSubjectPicks] = useState<Record<SubjectKey, string[]>>(() => ({ ...EMPTY_SUBJECT_PICKS }))
  const [featuredImageError, setFeaturedImageError] = useState<string | null>(null)
  useEffect(() => {
    if (!anySubjectOtherPicked(subjectPicks)) setSubjectOther('')
  }, [subjectPicks])
  const [additional, setAdditional] = useState({
    whatYouWillLearn: '',
    targetAudience: '',
    materialsIncluded: '',
    instructions: '',
    trainingStartDate: '',
    trainingEndDate: '',
    trainingMaxSeats: '',
  })
  const [curriculum, setCurriculum] = useState<CurriculumModule[]>([])
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [quizEditor, setQuizEditor] = useState<{ moduleId: string; topicId: string } | null>(null)
  const [lessonEditor, setLessonEditor] = useState<{ moduleId: string; topicId: string } | null>(null)
  const [assignmentEditor, setAssignmentEditor] = useState<{ moduleId: string; topicId: string } | null>(null)
  const [hydrating, setHydrating] = useState(() => Boolean(editCourseId))

  useEffect(() => {
    if (!editCourseId) {
      setHydrating(false)
      return
    }
    let cancelled = false
    setHydrating(true)
    setError(null)
    adminService
      .getCourse(editCourseId)
      .then((raw) => {
        if (cancelled) return
        const c = raw as Record<string, unknown>
        editDraftActiveRef.current = Boolean(c.active !== false)
        const w = mapApiCourseToWizardState(c)
        setBasic(w.basic)
        setUniversityOther(w.universityOther)
        setCourseOther(w.courseOther)
        setBranchOther(w.branchOther)
        setSubjectOther(w.subjectOther)
        setSubjectPicks(w.subjectPicks)
        setAdditional(w.additional)
        setCurriculum(w.curriculum)
        setExpandedModules(new Set(w.curriculum.map((m) => m.id)))
        slugTouched.current = true
        setStep(1)
        setHydrating(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load training. Check the link or try again from the course list.')
          setHydrating(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [editCourseId])

  const genId = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const addModule = () => {
    const id = genId()
    setCurriculum((c) => [...c, { id, title: '', order: c.length, topics: [], recordingFile: null }])
    setExpandedModules((s) => new Set([...s, id]))
  }

  const updateModule = (moduleId: string, field: 'title', value: string) => {
    setCurriculum((c) => c.map((m) => (m.id === moduleId ? { ...m, [field]: value } : m)))
  }

  const removeModule = (moduleId: string) => {
    setCurriculum((c) => c.filter((m) => m.id !== moduleId))
    setExpandedModules((s) => { const n = new Set(s); n.delete(moduleId); return n })
  }

  const toggleModuleExpanded = (moduleId: string) => {
    setExpandedModules((s) => {
      const n = new Set(s)
      if (n.has(moduleId)) n.delete(moduleId)
      else n.add(moduleId)
      return n
    })
  }

  const addTopic = (moduleId: string) => {
    const topic: CurriculumTopic = {
      id: genId(),
      title: '',
      type: 'Lecture',
      details: '',
      duration: '',
      recordingFile: null,
      recordingNote: '',
      isCurriculumDraft: true,
    }
    setCurriculum((c) => c.map((m) => (m.id === moduleId ? { ...m, topics: [...m.topics, topic] } : m)))
  }

  const updateTopic = (moduleId: string, topicId: string, field: 'title' | 'type' | 'details' | 'duration' | 'recordingNote', value: string) => {
    setCurriculum((c) =>
      c.map((m) =>
        m.id === moduleId
          ? { ...m, topics: m.topics.map((t) => (t.id === topicId ? { ...t, [field]: value } : t)) }
          : m
      )
    )
  }

  const patchTopic = (moduleId: string, topicId: string, patch: Partial<CurriculumTopic>) => {
    setCurriculum((c) =>
      c.map((m) =>
        m.id === moduleId
          ? { ...m, topics: m.topics.map((t) => (t.id === topicId ? { ...t, ...patch } : t)) }
          : m
      )
    )
  }

  const removeTopic = (moduleId: string, topicId: string) => {
    setQuizEditor((ed) => (ed?.moduleId === moduleId && ed?.topicId === topicId ? null : ed))
    setLessonEditor((ed) => (ed?.moduleId === moduleId && ed?.topicId === topicId ? null : ed))
    setAssignmentEditor((ed) => (ed?.moduleId === moduleId && ed?.topicId === topicId ? null : ed))
    setCurriculum((c) =>
      c.map((m) => (m.id === moduleId ? { ...m, topics: m.topics.filter((t) => t.id !== topicId) } : m))
    )
  }

  const linesToList = (s: string) =>
    s
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

  const tagsToList = (s: string) =>
    s
      .split(/[,]/)
      .map((t) => t.trim())
      .filter(Boolean)

  const buildPayload = (
    publish: boolean,
    media?: { featuredImageUrl?: string; introVideoUrl?: string },
  ) => {
    const durationVal = basic.durationValue.trim()
    const durationStr = durationVal ? `${durationVal} ${basic.durationUnit}` : ''
    const priceNum = basic.pricingFree ? 0 : basic.fee ? parseInt(basic.fee, 10) : 0
    const origNum = basic.originalPrice.trim() ? parseInt(basic.originalPrice, 10) : 0
    const curriculumSerial = curriculum.map((mod) => ({
      id: mod.id,
      title: mod.title,
      order: mod.order,
      recordingFileName: mod.recordingFile?.name ?? null,
      topics: mod.topics.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        details: t.details,
        duration: t.duration.trim(),
        recordingFileName: t.recordingFile?.name ?? null,
        recordingNote: t.recordingNote,
        ...(t.type === 'Lecture'
          ? {
              lessonContent: t.lessonContent ?? '',
              lessonVideoAttachMode: t.lessonVideoAttachMode ?? 'none',
              lessonVideoUrl: t.lessonVideoUrl?.trim() ?? '',
              lessonVideoRecordingRef: t.lessonVideoRecordingRef ?? null,
              lessonVideoHours: t.lessonVideoHours ?? '0',
              lessonVideoMinutes: t.lessonVideoMinutes ?? '0',
              lessonVideoSeconds: t.lessonVideoSeconds ?? '0',
              lessonPreviewEnabled: t.lessonPreviewEnabled ?? false,
              lessonFeaturedImageName: t.lessonFeaturedImageFile?.name ?? null,
              lessonVideoFileName: t.lessonVideoFile?.name ?? null,
              lessonExerciseFileName: t.lessonExerciseFile?.name ?? null,
            }
          : {}),
        ...(t.type === 'Quiz'
          ? {
              ...(t.quizQuestions !== undefined ? { quizQuestions: t.quizQuestions } : {}),
              ...(t.quizSettings !== undefined ? { quizSettings: t.quizSettings } : {}),
            }
          : {}),
        ...(t.type === 'Assignment'
          ? {
              assignment: { ...defaultAssignmentDraft(), ...(t.assignment ?? {}) },
            }
          : {}),
      })),
    }))
    const plainShort = plainTextFromHtml(basic.shortDesc)
    const plainFull = plainTextFromHtml(basic.fullDesc)
    const metaDescription = (plainFull || plainShort).slice(0, 4000)
    return {
      title: basic.title.trim(),
      slug: basic.slug.trim() || undefined,
      description: metaDescription,
      /** Catalog / cards expect plain text; short summary is authored in rich text but stored without tags. */
      shortDescription: plainShort,
      fullDescription: basic.fullDesc.trim(),
      category: (basic.category || 'Technical').toLowerCase().replace(/\s+/g, '-'),
      universities: resolveUniversitiesPayload(basic.universities, universityOther),
      courses: resolveCoursesPayload(basic.courses, courseOther),
      streams: resolveBranchesPayload(basic.branches, branchOther),
      subjects: flattenSubjectsPayload(basic.courses, subjectPicks, subjectOther),
      mode: basic.mode,
      durationValue: basic.durationValue,
      durationUnit: basic.durationUnit,
      duration: durationStr,
      fee: priceNum,
      price: priceNum,
      originalPrice: origNum > 0 ? origNum : undefined,
      trainerName: basic.trainerName.trim(),
      difficulty: basic.difficulty,
      // Always send strings (never `undefined`): axios/JSON drops undefined keys, so PATCH would skip
      // featuredImageUrl and Mongo would keep an old/broken cover after upload.
      featuredImageUrl: (media?.featuredImageUrl ?? basic.featuredImageUrl).trim(),
      introVideoUrl: (media?.introVideoUrl ?? basic.introVideoUrl).trim(),
      listingVisibility: basic.listingVisibility,
      scheduledPublishAt:
        basic.scheduleEnabled && basic.scheduleDate.trim()
          ? toScheduledIso(basic.scheduleDate, basic.scheduleTime)
          : undefined,
      whatYouWillLearn: linesToList(additional.whatYouWillLearn),
      targetAudience: additional.targetAudience.trim(),
      materialsIncluded: linesToList(additional.materialsIncluded),
      instructions: additional.instructions.trim(),
      trainingTags: tagsToList(basic.trainingTags),
      batches: [],
      trainingStartDate: additional.trainingStartDate.trim() || undefined,
      trainingEndDate: additional.trainingEndDate.trim() || undefined,
      trainingMaxSeats: additional.trainingMaxSeats.trim()
        ? parseInt(additional.trainingMaxSeats, 10)
        : undefined,
      curriculum: curriculumSerial,
      active: publish ? true : editCourseId ? editDraftActiveRef.current : false,
    }
  }

  const validateForPublish = (): string | null => {
    if (!basic.title.trim()) return 'Training title is required.'
    if (!basic.category) return 'Category is required.'
    if (!basic.universities.length) return 'Select at least one university.'
    if (basic.universities.includes(OTHER_UNIVERSITY_TOKEN) && !universityOther.trim()) {
      return 'Specify university name when Other is selected.'
    }
    const universitiesR = resolveUniversitiesPayload(basic.universities, universityOther)
    if (!universitiesR.length) return 'Select at least one university.'
    if (!basic.courses.length) return 'Select at least one applicable course.'
    if (basic.courses.includes(OTHER_COURSE_TOKEN) && !courseOther.trim()) {
      return 'Specify course name when Other is selected.'
    }
    const coursesR = resolveCoursesPayload(basic.courses, courseOther)
    if (!coursesR.length) return 'Select at least one applicable course.'
    if (needsBranchSection(basic.courses)) {
      const br = resolveBranchesPayload(basic.branches, branchOther)
      if (!br.length) return 'Select at least one applicable branch for B.Tech / Diploma.'
      if (basic.branches.includes(OTHER_BRANCH_VALUE) && !branchOther.trim()) {
        return 'Specify branch name when Others is selected.'
      }
    }
    if (needsSubjectSection(basic.courses)) {
      const subj = flattenSubjectsPayload(basic.courses, subjectPicks, subjectOther)
      if (!subj.length) return 'Select at least one applicable subject.'
      if (anySubjectOtherPicked(subjectPicks) && !subjectOther.trim()) {
        return 'Specify subject name when Other is selected in subjects.'
      }
    }
    if (!basic.mode.length) return 'Select at least one mode.'
    if (!basic.durationValue.trim() || parseInt(basic.durationValue, 10) < 1) return 'Duration value is required.'
    if (!['weeks', 'hours'].includes(basic.durationUnit)) return 'Duration unit must be weeks or hours.'
    if (!basic.trainerName.trim()) return 'Trainer name is required.'
    if (!basic.pricingFree && (!basic.fee.trim() || parseInt(basic.fee, 10) < 0)) return 'Enter a valid training fee or mark as free.'
    const sd = plainTextFromHtml(basic.shortDesc)
    if (sd.length < 20 || sd.length > 300) return 'Short summary (plain text) must be 20–300 characters.'
    const fd = plainTextFromHtml(basic.fullDesc)
    if (fd.length < 100) return 'Full description (plain text) must be at least 100 characters.'
    const tsd = additional.trainingStartDate.trim()
    const ted = additional.trainingEndDate.trim()
    if (tsd && ted && ted < tsd) return 'End date must be after start date.'
    const tms = additional.trainingMaxSeats.trim()
    if (tms && (parseInt(tms, 10) < 1 || Number.isNaN(parseInt(tms, 10)))) return 'Max seats must be a positive number.'
    if (!curriculum.length) return 'Add at least one curriculum module before publishing.'
    if (curriculum.some((m) => m.topics.some((t) => t.isCurriculumDraft))) {
      return 'Finish new curriculum topics (click Ok on each title/summary card) or cancel them before publishing.'
    }
    const badMod = curriculum.find((m) => !m.title.trim() || m.topics.some((t) => !t.title.trim()))
    if (badMod) return 'Each module needs a title; each topic needs a title.'
    return null
  }

  const resolveTrainingMedia = async (): Promise<
    | { ok: true; featuredImageUrl: string; introVideoUrl: string }
    | { ok: false; message: string }
  > => {
    let featuredUrl = basic.featuredImageUrl.trim()
    let introUrl = basic.introVideoUrl.trim()
    if (basic.thumbnail) {
      const pr = await prepareFeaturedTrainingImage(basic.thumbnail)
      if (!pr.ok) return { ok: false, message: pr.message }
      try {
        featuredUrl = await adminService.uploadCourseMedia(pr.file, 'featured')
      } catch {
        return { ok: false, message: 'Featured image upload failed.' }
      }
    }
    if (basic.introVideoFile) {
      try {
        introUrl = await adminService.uploadCourseMedia(basic.introVideoFile, 'intro')
      } catch {
        return { ok: false, message: 'Intro video upload failed. Use MP4, MOV, or AVI within the server size limit, or paste a YouTube link instead.' }
      }
    }
    return { ok: true, featuredImageUrl: featuredUrl, introVideoUrl: introUrl }
  }

  const payloadForApi = (payload: ReturnType<typeof buildPayload>): Record<string, unknown> => {
    const p = { ...(payload as unknown as Record<string, unknown>) }
    if (editCourseId) delete p.batches
    return p
  }

  const handleSaveDraft = async () => {
    if (!basic.title.trim()) {
      setError('Training title is required.')
      return
    }
    if (curriculum.some((m) => m.topics.some((t) => t.isCurriculumDraft))) {
      setError('Finish new curriculum topics (click Ok on each title/summary card) or cancel them before saving.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const media = await resolveTrainingMedia()
      if (!media.ok) {
        setError(media.message)
        return
      }
      const payload = payloadForApi(
        buildPayload(false, {
          featuredImageUrl: media.featuredImageUrl,
          introVideoUrl: media.introVideoUrl,
        }),
      )
      if (editCourseId) {
        await adminService.updateCourse(editCourseId, payload)
        invalidateCoursesListCache()
        navigate(`/admin/courses/${editCourseId}/manage`, { replace: true })
      } else {
        await adminService.createCourse(payload)
        invalidateCoursesListCache()
        navigate('/admin/courses', { replace: true })
      }
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response
        ? String((e.response as { data?: { error?: string } }).data?.error ?? 'Failed to save draft')
        : 'Failed to save draft'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    const v = validateForPublish()
    if (v) {
      setError(v)
      return
    }
    setError(null)
    setSaving(true)
    try {
      const media = await resolveTrainingMedia()
      if (!media.ok) {
        setError(media.message)
        return
      }
      const payload = payloadForApi(
        buildPayload(true, {
          featuredImageUrl: media.featuredImageUrl,
          introVideoUrl: media.introVideoUrl,
        }),
      )
      if (editCourseId) {
        await adminService.updateCourse(editCourseId, payload)
        editDraftActiveRef.current = true
        invalidateCoursesListCache()
        navigate(`/admin/courses/${editCourseId}/manage`, { replace: true })
      } else {
        await adminService.createCourse(payload)
        invalidateCoursesListCache()
        navigate('/admin/courses', { replace: true })
      }
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response
        ? String((e.response as { data?: { error?: string } }).data?.error ?? 'Failed to publish training')
        : 'Failed to publish training'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const quizEditorModule = quizEditor ? curriculum.find((m) => m.id === quizEditor.moduleId) : undefined
  const quizEditorTopic = quizEditorModule?.topics.find((t) => t.id === quizEditor?.topicId)
  const lessonEditorModule = lessonEditor ? curriculum.find((m) => m.id === lessonEditor.moduleId) : undefined
  const lessonEditorTopic = lessonEditorModule?.topics.find((t) => t.id === lessonEditor?.topicId)
  const assignmentEditorModule = assignmentEditor
    ? curriculum.find((m) => m.id === assignmentEditor.moduleId)
    : undefined
  const assignmentEditorTopic = assignmentEditorModule?.topics.find((t) => t.id === assignmentEditor?.topicId)
  const shortSummaryPlainLength = plainTextFromHtml(basic.shortDesc).length

  const [courseMediaStorage, setCourseMediaStorage] = useState<'unknown' | 's3' | 'local'>('unknown')
  useEffect(() => {
    let cancelled = false
    fetchApiHealth()
      .then((h) => {
        if (cancelled) return
        const m = h.courseMediaStorage
        setCourseMediaStorage(m === 's3' || m === 'local' ? m : 'unknown')
      })
      .catch(() => {
        if (!cancelled) setCourseMediaStorage('unknown')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rawFeaturedImageUrl = basic.featuredImageUrl.trim()
  const featuredHostedBasename = featuredImageStoredBasename(rawFeaturedImageUrl)
  const featuredPreviewHref =
    featuredHostedBasename && rawFeaturedImageUrl.startsWith('/')
      ? absoluteApiUrl(rawFeaturedImageUrl)
      : rawFeaturedImageUrl.startsWith('http')
        ? rawFeaturedImageUrl
        : ''

  if (hydrating) {
    return <div className="p-8 text-center text-slate-gray">Loading training…</div>
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,88rem)] space-y-6 px-0 sm:px-1">
      <div className="flex items-center gap-4">
        <Link
          to={editCourseId ? `/admin/courses/${editCourseId}/manage` : '/admin/courses'}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold text-brand-navy">
          {editCourseId ? 'Edit Training' : 'Add New Training'}
        </h2>
      </div>

      {editCourseId ? (
        <div className="sticky top-0 z-30 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 shadow-md backdrop-blur supports-[backdrop-filter]:bg-emerald-50/90 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-800 sm:max-w-[55%]">
            <span className="font-semibold text-brand-navy">Save changes</span> stores updates to the server, including a newly chosen{' '}
            <strong>cover image</strong> (upload runs on save). Use this from any step so you do not have to scroll back to Step 1.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> Save changes
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> Publish
            </button>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {courseMediaStorage === 'local' ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-semibold text-amber-900">Course media is stored on this machine only</p>
          <p className="mt-1 leading-relaxed text-amber-900/90">
            This API saves uploads under local disk, so cover images and videos work at{' '}
            <span className="font-mono text-xs">localhost:5000</span> but the live site loads the same paths from the
            cloud API (S3). Either set <span className="font-mono text-xs">COURSE_MEDIA_S3_BUCKET</span> in{' '}
            <span className="font-mono text-xs">backend/.env</span> to your dev bucket (see{' '}
            <span className="font-mono text-xs">backend/.env.example</span>), or open the admin panel with{' '}
            <span className="font-mono text-xs">VITE_API_URL</span> pointing at the deployed API and upload the cover
            there.
          </p>
        </div>
      ) : null}

      {/* Step indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              step === s ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {s === 1 ? 'Basics' : s === 2 ? 'Curriculum' : 'Additional'}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-brand-navy">Step 1 — Basics</h3>
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              <div>
                <label className="block text-sm font-medium text-gray-700">Training Title *</label>
                <input
                  type="text"
                  value={basic.title}
                  onChange={(e) => {
                    const t = e.target.value
                    setBasic((b) => {
                      const next = { ...b, title: t }
                      if (!slugTouched.current) next.slug = slugifyTitle(t)
                      return next
                    })
                  }}
                  placeholder="Min 5, max 150 characters"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">URL slug (optional)</label>
                <p className="mt-0.5 text-xs text-slate-500">Lowercase letters, numbers, hyphens. Leave blank to auto-generate from title.</p>
                <input
                  type="text"
                  value={basic.slug}
                  onChange={(e) => {
                    slugTouched.current = true
                    setBasic((b) => ({ ...b, slug: e.target.value }))
                  }}
                  placeholder="e.g. full-stack-internship"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <RichTextEditor
                id="training-short-html"
                label="Short summary *"
                hint="Teaser for cards and hero only — not the full course write-up. After removing formatting, plain text must stay within the limit below."
                value={basic.shortDesc}
                onChange={(html) => setBasic((b) => ({ ...b, shortDesc: html }))}
                placeholder="Brief summary for listings…"
                minHeightClass="min-h-[100px]"
              />
              <p
                className={`text-xs ${shortSummaryPlainLength >= 20 && shortSummaryPlainLength <= 300 ? 'text-slate-600' : 'font-medium text-amber-800'}`}
                aria-live="polite"
              >
                Plain text length: {shortSummaryPlainLength}/300 (publish requires 20–300).{' '}
                {shortSummaryPlainLength > 300
                  ? 'Shorten this field and move the long version into Full description below.'
                  : shortSummaryPlainLength < 20
                    ? 'Add a bit more for the minimum length.'
                    : 'Within range for publish.'}
              </p>
              <RichTextEditor
                id="training-full-html"
                label="Full description *"
                hint="Main course page content. Rich text is stored as HTML (min 100 characters of plain text)."
                value={basic.fullDesc}
                onChange={(html) => setBasic((b) => ({ ...b, fullDesc: html }))}
                placeholder="Detailed course description…"
                minHeightClass="min-h-[220px]"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Difficulty</label>
                  <select
                    value={basic.difficulty}
                    onChange={(e) => setBasic((b) => ({ ...b, difficulty: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category *</label>
                  <select
                    value={basic.category}
                    onChange={(e) => setBasic((b) => ({ ...b, category: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Applicable Universities *</label>
                  <p className="mt-0.5 text-xs text-slate-500">Select one or more universities</p>
                  <select
                    multiple
                    value={basic.universities}
                    onChange={(e) => {
                      const universities = Array.from(e.target.selectedOptions, (o) => o.value)
                      setBasic((b) => ({ ...b, universities }))
                      if (!universities.includes(OTHER_UNIVERSITY_TOKEN)) setUniversityOther('')
                    }}
                    className="mt-1 w-full min-h-[100px] rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                    title="Select one or more universities"
                  >
                    <option disabled value="">
                      — Select one or more universities —
                    </option>
                    {UNIVERSITIES_LIST.map((u) => (
                      <option key={u.name} value={u.name}>{u.shortForm} — {u.name}</option>
                    ))}
                    <option value={OTHER_UNIVERSITY_TOKEN}>Other (specify below)</option>
                  </select>
                  {basic.universities.includes(OTHER_UNIVERSITY_TOKEN) ? (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-600">Specify university name *</label>
                      <input
                        type="text"
                        value={universityOther}
                        onChange={(e) => setUniversityOther(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="University or board name"
                      />
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Applicable Course(s) *</label>
                  <p className="mt-0.5 text-xs text-slate-500">Select one or more courses</p>
                  <select
                    multiple
                    value={basic.courses}
                    onChange={(e) => {
                      const courses = Array.from(e.target.selectedOptions, (o) => o.value)
                      setBasic((b) => ({ ...b, courses, branches: [] }))
                      setSubjectPicks({ ...EMPTY_SUBJECT_PICKS })
                      setBranchOther('')
                      setSubjectOther('')
                      if (!courses.includes(OTHER_COURSE_TOKEN)) setCourseOther('')
                    }}
                    className="mt-1 w-full min-h-[100px] rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                    title="Select one or more courses"
                  >
                    <option disabled value="">
                      — Select one or more courses —
                    </option>
                    {COURSE_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  {basic.courses.includes(OTHER_COURSE_TOKEN) ? (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-600">Specify course name *</label>
                      <input
                        type="text"
                        value={courseOther}
                        onChange={(e) => setCourseOther(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Course name"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              {needsBranchSection(basic.courses) ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Applicable Branch(es) *</label>
                  <p className="text-xs text-slate-500">Select one or more branches (official list).</p>
                  <select
                    multiple
                    value={basic.branches}
                    onChange={(e) => {
                      const branches = Array.from(e.target.selectedOptions, (o) => o.value)
                      setBasic((b) => ({ ...b, branches }))
                      if (!branches.includes(OTHER_BRANCH_VALUE)) setBranchOther('')
                    }}
                    className="mt-1 w-full min-h-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                    title="Branches"
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  {basic.branches.includes(OTHER_BRANCH_VALUE) ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Specify branch name *</label>
                      <input
                        type="text"
                        value={branchOther}
                        onChange={(e) => setBranchOther(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {needsSubjectSection(basic.courses) ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-700">Applicable Subject(s) *</p>
                  {subjectKeysForCourses(basic.courses).map((key) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600">{key}</label>
                      <select
                        multiple
                        value={subjectPicks[key]}
                        onChange={(e) => {
                          const sel = Array.from(e.target.selectedOptions, (o) => o.value)
                          setSubjectPicks((sp) => ({ ...sp, [key]: sel }))
                        }}
                        className="mt-1 w-full min-h-[88px] rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                      >
                        {SUBJECT_LIST_BY_KEY[key].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {anySubjectOtherPicked(subjectPicks) ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Specify subject name *</label>
                      <input
                        type="text"
                        value={subjectOther}
                        onChange={(e) => setSubjectOther(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-gray-700">Mode(s) *</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MODES.map((m) => (
                    <label key={m} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={basic.mode.includes(m)}
                        onChange={(e) => setBasic((b) => ({
                          ...b,
                          mode: e.target.checked ? [...b.mode, m] : b.mode.filter((x) => x !== m),
                        }))}
                        className="rounded text-brand-accent"
                      />
                      <span className="text-sm">{m}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Duration Value *</label>
                  <input
                    type="number"
                    min={1}
                    value={basic.durationValue}
                    onChange={(e) => setBasic((b) => ({ ...b, durationValue: e.target.value }))}
                    className="mt-1 w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Unit</label>
                  <select
                    value={basic.durationUnit}
                    onChange={(e) => setBasic((b) => ({ ...b, durationUnit: e.target.value }))}
                    className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="weeks">Weeks</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Trainer Name *</label>
                <input
                  type="text"
                  value={basic.trainerName}
                  onChange={(e) => setBasic((b) => ({ ...b, trainerName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <aside className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/90 p-4 lg:col-span-4 lg:sticky lg:top-4 lg:self-start">
              <div>
                <label className="block text-sm font-medium text-gray-700">Visibility</label>
                <p className="mt-0.5 text-xs text-slate-500">Public: listed on Trainings. Unlisted: hidden from catalog but still open via direct link.</p>
                <select
                  value={basic.listingVisibility}
                  onChange={(e) => setBasic((b) => ({ ...b, listingVisibility: e.target.value as 'public' | 'unlisted' }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="public">Public (catalog)</option>
                  <option value="unlisted">Unlisted (direct link only)</option>
                </select>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <input
                    type="checkbox"
                    checked={basic.scheduleEnabled}
                    onChange={(e) => setBasic((b) => ({ ...b, scheduleEnabled: e.target.checked }))}
                    className="rounded text-brand-accent"
                  />
                  Schedule publish (optional)
                </label>
                <p className="text-xs text-slate-500">Stored as a reminder; listing still follows Publish / Active rules today.</p>
                {basic.scheduleEnabled ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Date</label>
                      <input
                        type="date"
                        value={basic.scheduleDate}
                        onChange={(e) => setBasic((b) => ({ ...b, scheduleDate: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Time</label>
                      <input
                        type="time"
                        value={basic.scheduleTime}
                        onChange={(e) => setBasic((b) => ({ ...b, scheduleTime: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Featured image</label>
                <p className="mt-0.5 text-xs text-slate-500">
                  JPEG or PNG, up to 12MB. On save we center-crop to 16:9, optimize to about 1920×1080 (under 2MB), and store the cover as <strong>JPEG</strong> — the saved path ends in{' '}
                  <code className="rounded bg-slate-100 px-0.5">.jpg</code> even if you picked a PNG (transparency is flattened). Optional URL, or upload below. The file is sent to the server when you click{' '}
                  <strong>Save changes</strong> (top bar) or <strong>Save as Draft</strong> / <strong>Publish</strong> at the bottom.
                </p>
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={basic.featuredImageUrl}
                  onChange={(e) => setBasic((b) => ({ ...b, featuredImageUrl: e.target.value }))}
                  placeholder="https://… or leave empty and upload below"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm"
                />
                <p className="mt-1 text-[11px] leading-snug text-slate-500">
                  This field uses <strong className="text-slate-700">plain text</strong> (not browser &quot;URL&quot; validation) so our saved path{' '}
                  <code className="rounded bg-slate-100 px-0.5">/api/courses/media/featured/…</code> is not cut off. For an external image, paste a full{' '}
                  <code className="rounded bg-slate-100 px-0.5">https://…</code> link.
                </p>
                {featuredHostedBasename ? (
                  <p className="mt-1 text-xs text-emerald-800">
                    <span className="font-medium text-slate-700">Saved on server (file name):</span>{' '}
                    <span className="break-all font-mono text-[11px]">{featuredHostedBasename}</span>
                    {featuredPreviewHref ? (
                      <>
                        {' · '}
                        <a
                          href={featuredPreviewHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-brand-accent underline hover:text-primary-600"
                        >
                          Preview image
                        </a>
                      </>
                    ) : null}
                    {!String(featuredHostedBasename).match(/\.(jpe?g|png)$/i) ? (
                      <span className="mt-1 block text-amber-800">
                        This file name looks incomplete (missing <code className="rounded bg-amber-100 px-0.5">.jpg</code> /{' '}
                        <code className="rounded bg-amber-100 px-0.5">.png</code>). Re-upload the cover and click <strong>Save changes</strong>.
                      </span>
                    ) : null}
                  </p>
                ) : null}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setBasic((b) => ({ ...b, thumbnail: f }))
                    setFeaturedImageError(null)
                    if (!f) return
                    const r = validateFeaturedTrainingImageQuick(f)
                    if (!r.ok) {
                      setFeaturedImageError(r.message)
                      setBasic((b) => ({ ...b, thumbnail: null }))
                      e.target.value = ''
                    }
                  }}
                  className="mt-2 w-full text-xs text-gray-600"
                />
                {featuredImageError ? (
                  <p className="mt-1 text-xs text-red-600" role="alert">{featuredImageError}</p>
                ) : null}
                {basic.thumbnail ? (
                  <p className="mt-1 text-xs text-slate-600 truncate" title={basic.thumbnail.name}>
                    <span className="font-medium text-slate-700">Selected file:</span> {basic.thumbnail.name}
                    <span className="mt-0.5 block font-normal text-slate-500">
                      After save, the hosted file is JPEG (<code className="rounded bg-slate-100 px-0.5">.jpg</code>); use Preview image to confirm it opens.
                    </span>
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Intro video</label>
                <p className="mt-0.5 text-xs text-slate-500">
                  <strong>Option A — Link:</strong> Paste a <strong>YouTube</strong> or Vimeo URL (unchanged behaviour). The public course page embeds YouTube and shows &quot;Open on YouTube&quot; when applicable.
                </p>
                <input
                  type="url"
                  value={basic.introVideoUrl}
                  onChange={(e) => setBasic((b) => ({ ...b, introVideoUrl: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                <p className="mt-3 text-xs text-slate-500">
                  <strong>Option B — Upload from computer:</strong> MP4, MOV, or AVI. The file is uploaded when you click <strong>Save as Draft</strong> or <strong>Publish</strong> (same pattern as the featured image). If you choose a file, the saved course uses that hosted video URL for the intro; you can still keep a link above for reference, but the upload wins on save.
                </p>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov,.avi"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setBasic((b) => ({ ...b, introVideoFile: f }))
                  }}
                  className="mt-1 w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-800 file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-white"
                />
                {basic.introVideoFile ? (
                  <p className="mt-1 text-xs text-slate-600 truncate" title={basic.introVideoFile.name}>
                    Selected: {basic.introVideoFile.name}
                  </p>
                ) : null}
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700">Pricing</span>
                <div className="mt-2 flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="pricing-model"
                      checked={basic.pricingFree}
                      onChange={() => setBasic((b) => ({ ...b, pricingFree: true, fee: '' }))}
                      className="text-brand-accent"
                    />
                    Free
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="pricing-model"
                      checked={!basic.pricingFree}
                      onChange={() => setBasic((b) => ({ ...b, pricingFree: false }))}
                      className="text-brand-accent"
                    />
                    Paid
                  </label>
                </div>
                {!basic.pricingFree ? (
                  <div className="mt-2 space-y-2">
                    <input
                      type="number"
                      min={0}
                      value={basic.fee}
                      onChange={(e) => setBasic((b) => ({ ...b, fee: e.target.value }))}
                      placeholder="Fee (₹)"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    />
                    <div>
                      <label className="text-xs font-medium text-gray-600">Original price (₹, optional)</label>
                      <input
                        type="number"
                        min={0}
                        value={basic.originalPrice}
                        onChange={(e) => setBasic((b) => ({ ...b, originalPrice: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tags</label>
                <p className="mt-0.5 text-xs text-slate-500">Comma-separated keywords.</p>
                <input
                  type="text"
                  value={basic.trainingTags}
                  onChange={(e) => setBasic((b) => ({ ...b, trainingTags: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="python, flask, aws"
                />
              </div>
              <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-600">
                <span className="font-medium text-gray-800">Author (internal)</span>
                <p className="mt-1">
                  {authUser?.name || '—'}
                  {authUser?.email ? <span className="block text-slate-500">{authUser.email}</span> : null}
                </p>
                <p className="mt-1 text-slate-500">
                  Auto-filled from the logged-in admin when you create a training; editable by super admin. It is not updated automatically when another admin edits the course. Students see the <strong>Trainer Name</strong> field on the public page.
                </p>
              </div>
            </aside>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Save className="h-4 w-4" /> Save as Draft
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
            >
              Continue to Curriculum →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4 sm:p-6 sm:space-y-5">
          <h3 className="font-semibold text-brand-navy">Step 2 — Curriculum</h3>
          <p className="text-sm text-slate-gray max-w-4xl">
            Add modules, then use <strong className="text-gray-800">Add topic</strong> for a card (title, summary, Cancel / Ok). After Ok, choose <strong>Lesson</strong>, <strong>Quiz</strong>, or <strong>Assignment</strong> only. Use the lesson builder for video, thumbnail, notes, and attachments.
          </p>

          <div className="space-y-4">
            {curriculum.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center text-slate-gray text-sm">
                <p>No modules yet. Click &quot;Add Module&quot; to add your first module, then add topics inside it.</p>
              </div>
            ) : (
              curriculum.map((mod, modIndex) => (
                <div key={mod.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50/90 px-3 py-2.5 sm:px-4">
                    <button
                      type="button"
                      onClick={() => toggleModuleExpanded(mod.id)}
                      className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                      aria-label={expandedModules.has(mod.id) ? 'Collapse' : 'Expand'}
                    >
                      {expandedModules.has(mod.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <span className="w-9 shrink-0 text-center text-xs font-semibold text-gray-500">M{modIndex + 1}</span>
                    <input
                      type="text"
                      value={mod.title}
                      onChange={(e) => updateModule(mod.id, 'title', e.target.value)}
                      placeholder="Module title"
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-brand-navy placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeModule(mod.id)}
                      className="shrink-0 rounded p-2 text-red-600 hover:bg-red-50"
                      title="Remove module"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {expandedModules.has(mod.id) && (
                    <div className="space-y-4 p-3 sm:p-5">
                      {/* Topics — wide cards, lesson / quiz / assignment only */}
                      <div className="space-y-4">
                        {mod.topics.map((topic, topicIndex) => (
                          <div
                            key={topic.id}
                            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-gray-100/80 sm:p-5"
                          >
                            <div className="flex gap-3 sm:gap-4">
                              <div
                                className="shrink-0 pt-1 text-gray-300"
                                title="Topics are ordered top to bottom in this module"
                                aria-hidden
                              >
                                <GripVertical className="h-5 w-5" />
                              </div>
                              {topic.isCurriculumDraft ? (
                                <div className="min-w-0 flex-1 space-y-3">
                                  <input
                                    type="text"
                                    value={topic.title}
                                    onChange={(e) => updateTopic(mod.id, topic.id, 'title', e.target.value)}
                                    placeholder="Add a title"
                                    aria-label={`Topic ${topicIndex + 1} title`}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-brand-navy placeholder:text-gray-400 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                                  />
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Summary</label>
                                    <textarea
                                      value={topic.details}
                                      onChange={(e) => updateTopic(mod.id, topic.id, 'details', e.target.value)}
                                      placeholder="Add a summary"
                                      rows={4}
                                      className="min-h-[100px] w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                                    <button
                                      type="button"
                                      onClick={() => removeTopic(mod.id, topic.id)}
                                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!topic.title.trim()}
                                      title={!topic.title.trim() ? 'Add a title first' : undefined}
                                      onClick={() => patchTopic(mod.id, topic.id, { isCurriculumDraft: false })}
                                      className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Ok
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="min-w-0 flex-1 space-y-3">
                                <input
                                  type="text"
                                  value={topic.title}
                                  onChange={(e) => updateTopic(mod.id, topic.id, 'title', e.target.value)}
                                  placeholder="Add a title"
                                  aria-label={`Topic ${topicIndex + 1} title`}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-brand-navy placeholder:text-gray-400 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                                />
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-600">Summary</label>
                                  <textarea
                                    value={topic.details}
                                    onChange={(e) => updateTopic(mod.id, topic.id, 'details', e.target.value)}
                                    placeholder="Add a summary"
                                    rows={4}
                                    className="min-h-[100px] w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                                  />
                                </div>
                                <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex flex-wrap gap-2">
                                    {TOPIC_TYPE_ORDER.map((t) => (
                                      <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                          updateTopic(mod.id, topic.id, 'type', t)
                                          if (t === 'Quiz') {
                                            setLessonEditor(null)
                                            setAssignmentEditor(null)
                                            setQuizEditor({ moduleId: mod.id, topicId: topic.id })
                                          } else if (t === 'Lecture') {
                                            setQuizEditor(null)
                                            setAssignmentEditor(null)
                                            setLessonEditor({ moduleId: mod.id, topicId: topic.id })
                                          } else {
                                            setQuizEditor(null)
                                            setLessonEditor(null)
                                            setAssignmentEditor({ moduleId: mod.id, topicId: topic.id })
                                          }
                                        }}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                          topic.type === t
                                            ? 'border-brand-accent bg-blue-50 text-brand-navy shadow-sm ring-1 ring-brand-accent/25'
                                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                                        }`}
                                      >
                                        <Plus className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                        {topicTypeButtonLabel(t)}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-slate-500"
                                      title="Same curriculum data as before; content bank can be wired later."
                                    >
                                      <Library className="h-3.5 w-3.5" />
                                      Content bank
                                    </span>
                                    <button
                                      type="button"
                                      className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
                                      aria-label="More options"
                                      title="More options"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-3 space-y-3">
                                  {topic.type === 'Lecture' ? (
                                    <>
                                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5">
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-brand-navy">Lesson content</p>
                                          <p className="text-xs text-gray-600">
                                            Write the full lesson in the editor; the summary field above is the short line in the curriculum list.
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setQuizEditor(null)
                                            setAssignmentEditor(null)
                                            setLessonEditor({ moduleId: mod.id, topicId: topic.id })
                                          }}
                                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-accent bg-white px-3 py-2 text-xs font-semibold text-brand-accent shadow-sm hover:bg-blue-50"
                                        >
                                          <BookOpen className="h-3.5 w-3.5" />
                                          Add / edit lesson
                                        </button>
                                      </div>
                                      {buildLessonPreviewLines(topic).length > 0 ? (
                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
                                            Added to this topic (preview)
                                          </p>
                                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-emerald-950">
                                            {buildLessonPreviewLines(topic).map((line, li) => (
                                              <li key={li}>{line}</li>
                                            ))}
                                          </ul>
                                          <div className="mt-2 flex flex-wrap gap-2 border-t border-emerald-200/60 pt-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setQuizEditor(null)
                                                setAssignmentEditor(null)
                                                setLessonEditor({ moduleId: mod.id, topicId: topic.id })
                                              }}
                                              className="inline-flex items-center gap-1 rounded-md border border-emerald-700/25 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100"
                                            >
                                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                                              Edit lesson
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5">
                                          <p className="text-xs text-slate-600">
                                            Nothing saved yet. Use <strong>Save</strong> in the lesson window to store content, then you&apos;ll see it listed here.
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setQuizEditor(null)
                                              setAssignmentEditor(null)
                                              setLessonEditor({ moduleId: mod.id, topicId: topic.id })
                                            }}
                                            className="mt-2 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100"
                                          >
                                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                                            Open lesson builder
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  ) : null}
                                  {topic.type === 'Quiz' ? (
                                    <>
                                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5">
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-brand-navy">Quiz questions</p>
                                          <p className="text-xs text-gray-600">
                                            {(topic.quizQuestions?.length ?? 0) === 0
                                              ? 'No questions yet.'
                                              : `${topic.quizQuestions?.length} question(s) — MCQ, true/false, short answer, or fill-in-the-blank.`}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setLessonEditor(null)
                                            setAssignmentEditor(null)
                                            setQuizEditor({ moduleId: mod.id, topicId: topic.id })
                                          }}
                                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-500/40 bg-white px-3 py-2 text-xs font-semibold text-violet-900 shadow-sm hover:bg-violet-50"
                                        >
                                          <ClipboardList className="h-3.5 w-3.5" />
                                          Add / edit quiz
                                        </button>
                                      </div>
                                      {(topic.quizQuestions?.length ?? 0) > 0 ? (
                                        <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2.5">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">
                                            Questions in this quiz (preview)
                                          </p>
                                          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-violet-950">
                                            {topic.quizQuestions!.map((q, qi) => {
                                              const qq = migrateQuizQuestion(q, qi)
                                              return (
                                                <li key={qq.id}>
                                                  {(qq.title || '').trim() || `Question ${qi + 1}`}
                                                  <span className="text-violet-800/90"> · {questionSummaryLine(qq)}</span>
                                                </li>
                                              )
                                            })}
                                          </ol>
                                          <div className="mt-2 flex flex-wrap gap-2 border-t border-violet-200/60 pt-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setLessonEditor(null)
                                                setAssignmentEditor(null)
                                                setQuizEditor({ moduleId: mod.id, topicId: topic.id })
                                              }}
                                              className="inline-flex items-center gap-1 rounded-md border border-violet-700/25 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-900 shadow-sm hover:bg-violet-100"
                                            >
                                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                                              Edit quiz
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5">
                                          <p className="text-xs text-slate-600">
                                            No questions saved yet. Add questions in the quiz window and click <strong>Save</strong> to list them here.
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setLessonEditor(null)
                                              setAssignmentEditor(null)
                                              setQuizEditor({ moduleId: mod.id, topicId: topic.id })
                                            }}
                                            className="mt-2 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100"
                                          >
                                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                                            Open quiz builder
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  ) : null}
                                  {topic.type === 'Assignment' ? (
                                    <>
                                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-brand-navy">Assignment</p>
                                          <p className="text-xs text-gray-600">
                                            {topic.assignment?.title?.trim()
                                              ? `${topic.assignment.title.trim()} · max ${topic.assignment.maxMarks || '—'} marks`
                                              : 'Set instructions, submission types, size limit, and deadlines.'}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setQuizEditor(null)
                                            setLessonEditor(null)
                                            setAssignmentEditor({ moduleId: mod.id, topicId: topic.id })
                                          }}
                                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-600/35 bg-white px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-100/80"
                                        >
                                          <ClipboardCheck className="h-3.5 w-3.5" />
                                          Add / edit assignment
                                        </button>
                                      </div>
                                      {topic.assignment?.instructions?.trim() ? (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-950">
                                            Saved assignment (preview)
                                          </p>
                                          <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-amber-950">
                                            {topic.assignment.instructions.trim().length > 280
                                              ? `${topic.assignment.instructions.trim().slice(0, 280)}…`
                                              : topic.assignment.instructions.trim()}
                                          </p>
                                          <div className="mt-2 flex flex-wrap gap-2 border-t border-amber-200/60 pt-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setQuizEditor(null)
                                                setLessonEditor(null)
                                                setAssignmentEditor({ moduleId: mod.id, topicId: topic.id })
                                              }}
                                              className="inline-flex items-center gap-1 rounded-md border border-amber-800/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-100"
                                            >
                                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                                              Edit assignment
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5">
                                          <p className="text-xs text-slate-600">
                                            No assignment details saved yet. Open the builder and click <strong>Save</strong>.
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setQuizEditor(null)
                                              setLessonEditor(null)
                                              setAssignmentEditor({ moduleId: mod.id, topicId: topic.id })
                                            }}
                                            className="mt-2 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100"
                                          >
                                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                                            Open assignment builder
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-50 pt-3">
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Duration</label>
                                    <input
                                      type="text"
                                      value={topic.duration}
                                      onChange={(e) => updateTopic(mod.id, topic.id, 'duration', e.target.value)}
                                      placeholder="e.g. 15 min"
                                      title="Shown on public curriculum"
                                      className="w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-sm sm:w-36"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeTopic(mod.id, topic.id)}
                                    className="text-sm font-medium text-red-600 hover:text-red-700"
                                  >
                                    Remove topic
                                  </button>
                                </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addTopic(mod.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 sm:w-auto sm:min-w-[200px]"
                        >
                          <Plus className="h-4 w-4" /> Add topic
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <button
              type="button"
              onClick={addModule}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-brand-accent px-4 py-2.5 text-sm font-medium text-brand-accent hover:bg-brand-accent/5 w-full justify-center"
            >
              <Plus className="h-4 w-4" /> Add Module
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Save className="h-4 w-4 inline mr-1" /> Save as Draft
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
            >
              Continue to Additional →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-semibold text-brand-navy">Step 3 — Additional</h3>
            <p className="text-sm text-slate-gray mt-1">
              Optional training schedule and seat cap appear on listings and the public course page. Learning outcomes, requirements, materials, and instructions are shown as separate sections for students.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-800">Training schedule (optional)</h4>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600">Training start date</label>
                <input
                  type="date"
                  value={additional.trainingStartDate}
                  onChange={(e) => setAdditional((a) => ({ ...a, trainingStartDate: e.target.value }))}
                  className="mt-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Training end date</label>
                <input
                  type="date"
                  value={additional.trainingEndDate}
                  onChange={(e) => setAdditional((a) => ({ ...a, trainingEndDate: e.target.value }))}
                  className="mt-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                />
              </div>
              <div className="w-32 sm:w-36">
                <label className="block text-xs font-medium text-gray-600">Max seats</label>
                <input
                  type="number"
                  min={1}
                  value={additional.trainingMaxSeats}
                  onChange={(e) => setAdditional((a) => ({ ...a, trainingMaxSeats: e.target.value }))}
                  placeholder="Unlimited"
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">Leave blank for evergreen access or no seat limit.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">What you&apos;ll learn</label>
              <p className="text-xs text-slate-500 mt-0.5">One outcome per line.</p>
              <textarea
                rows={4}
                value={additional.whatYouWillLearn}
                onChange={(e) => setAdditional((a) => ({ ...a, whatYouWillLearn: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={'e.g. Build REST APIs with Flask\ne.g. Deploy to AWS Lambda'}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Requirements / Who is this course for?</label>
              <p className="text-xs text-slate-500 mt-0.5">
                Each line becomes a bullet under <strong>Requirements</strong> on the course page. Include eligibility, prerequisites, and who should take this course.
              </p>
              <textarea
                rows={3}
                value={additional.targetAudience}
                onChange={(e) => setAdditional((a) => ({ ...a, targetAudience: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Materials included</label>
              <p className="text-xs text-slate-500 mt-0.5">One item per line (shown under What&apos;s Included).</p>
              <textarea
                rows={3}
                value={additional.materialsIncluded}
                onChange={(e) => setAdditional((a) => ({ ...a, materialsIncluded: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Instructions &amp; requirements (student prep)</label>
              <p className="text-xs text-slate-500 mt-0.5">
                Each line becomes a bullet under <strong>Instructions</strong> on the course page — e.g. software to install, hardware, things to prepare before the course starts.
              </p>
              <textarea
                rows={3}
                value={additional.instructions}
                onChange={(e) => setAdditional((a) => ({ ...a, instructions: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={'e.g. Install Python 3.11+\ne.g. Laptop with 8GB RAM'}
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep(2)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Save className="h-4 w-4" /> Save as Draft
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
            >
              <Send className="h-4 w-4" /> Publish Training
            </button>
          </div>
        </div>
      )}

      {quizEditor && quizEditorModule && quizEditorTopic ? (
        <QuizBuilderModal
          open
          moduleTitle={quizEditorModule.title}
          topicLabel={quizEditorTopic.title}
          initialTitle={quizEditorTopic.title}
          initialSummary={quizEditorTopic.details}
          initialQuestions={quizEditorTopic.quizQuestions ?? []}
          initialSettings={quizEditorTopic.quizSettings}
          onClose={() => setQuizEditor(null)}
          onSave={(draft: QuizTopicDraft) => {
            patchTopic(quizEditor.moduleId, quizEditor.topicId, {
              title: draft.title,
              details: draft.summary,
              quizQuestions: draft.questions,
              quizSettings: draft.settings,
            })
            setQuizEditor(null)
          }}
        />
      ) : null}

      {assignmentEditor && assignmentEditorModule && assignmentEditorTopic ? (
        <AssignmentBuilderModal
          open
          moduleTitle={assignmentEditorModule.title}
          topicLabel={assignmentEditorTopic.title}
          initialTitle={assignmentEditorTopic.title}
          initialSummary={assignmentEditorTopic.details}
          initialAssignment={assignmentEditorTopic.assignment}
          onClose={() => setAssignmentEditor(null)}
          onSave={(draft) => {
            patchTopic(assignmentEditor.moduleId, assignmentEditor.topicId, {
              title: draft.title,
              details: draft.summary,
              assignment: draft.assignment,
            })
            setAssignmentEditor(null)
          }}
        />
      ) : null}

      {lessonEditor && lessonEditorModule && lessonEditorTopic ? (
        <LessonBuilderModal
          open
          moduleTitle={lessonEditorModule.title}
          topicLabel={lessonEditorTopic.title}
          initialTitle={lessonEditorTopic.title}
          initialLessonContent={lessonEditorTopic.lessonContent ?? ''}
          initialVideoMode={lessonVideoAttachModeFromTopic(lessonEditorTopic)}
          initialLessonVideoUrl={lessonEditorTopic.lessonVideoUrl ?? ''}
          initialLessonVideoRecordingRef={lessonEditorTopic.lessonVideoRecordingRef ?? null}
          initialVideoHours={lessonEditorTopic.lessonVideoHours ?? '0'}
          initialVideoMinutes={lessonEditorTopic.lessonVideoMinutes ?? '0'}
          initialVideoSeconds={lessonEditorTopic.lessonVideoSeconds ?? '0'}
          initialLessonPreviewEnabled={lessonEditorTopic.lessonPreviewEnabled ?? false}
          initialLessonFeaturedImageFile={lessonEditorTopic.lessonFeaturedImageFile ?? null}
          initialLessonVideoFile={lessonEditorTopic.lessonVideoFile ?? null}
          initialLessonExerciseFile={lessonEditorTopic.lessonExerciseFile ?? null}
          recordingOptions={[]}
          onClose={() => setLessonEditor(null)}
          onSave={(draft: LessonTopicDraft) => {
            const mode = draft.lessonVideoAttachMode
            const base: Partial<CurriculumTopic> = {
              title: draft.title,
              lessonContent: draft.lessonContent,
              lessonVideoAttachMode: mode,
              lessonVideoHours: draft.videoHours,
              lessonVideoMinutes: draft.videoMinutes,
              lessonVideoSeconds: draft.videoSeconds,
              lessonPreviewEnabled: draft.lessonPreviewEnabled,
              lessonFeaturedImageFile: draft.lessonFeaturedImageFile,
              lessonExerciseFile: draft.lessonExerciseFile,
            }
            if (mode === 'url') {
              base.lessonVideoUrl = draft.lessonVideoUrl
              base.lessonVideoRecordingRef = null
              base.lessonVideoFile = null
            } else if (mode === 'file') {
              base.lessonVideoFile = draft.lessonVideoFile
              base.lessonVideoUrl = ''
              base.lessonVideoRecordingRef = null
            } else if (mode === 'recording') {
              base.lessonVideoRecordingRef = draft.lessonVideoRecordingRef
              base.lessonVideoUrl = ''
              base.lessonVideoFile = null
            } else {
              base.lessonVideoUrl = ''
              base.lessonVideoRecordingRef = null
              base.lessonVideoFile = null
            }
            patchTopic(lessonEditor.moduleId, lessonEditor.topicId, base)
            setLessonEditor(null)
          }}
        />
      ) : null}
    </div>
  )
}
