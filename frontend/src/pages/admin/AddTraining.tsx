/**
 * Admin — Add New Training (AD-WF-03). 3-step: Basics → Curriculum → Additional (batches + audience copy).
 */
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Video,
  FileText,
  Search,
  GripVertical,
  MoreHorizontal,
  Library,
  ClipboardList,
  BookOpen,
} from 'lucide-react'
import { UNIVERSITIES_LIST } from '@/constants/universities'
import { adminService } from '@/services/adminService'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import { QuizBuilderModal, type QuizTopicDraft, type QuizSettingsDraft } from '@/components/admin/QuizBuilderModal'
import {
  LessonBuilderModal,
  type LessonTopicDraft,
  type LessonVideoAttachMode,
} from '@/components/admin/LessonBuilderModal'
import { plainTextFromHtml } from '@/utils/sanitizeHtml'
import { useAuthStore } from '@/store/authStore'

/** Non‑Pro types first; Lab, Assignment, Interview (Pro) at the end. */
const TOPIC_TYPE_ORDER = ['Lecture', 'Quiz', 'Reading', 'Recording', 'Lab', 'Assignment', 'Interview'] as const
type TopicType = (typeof TOPIC_TYPE_ORDER)[number]

const PRO_TOPIC_TYPES = new Set<TopicType>(['Lab', 'Assignment', 'Interview'])

function isProTopicType(t: TopicType): boolean {
  return PRO_TOPIC_TYPES.has(t)
}

/** Button labels aligned with Tutor-style wording; values stored unchanged. */
function topicTypeButtonLabel(t: TopicType): string {
  if (t === 'Lecture') return 'Lesson'
  if (t === 'Quiz') return 'Quiz'
  if (t === 'Assignment') return 'Assignment'
  if (t === 'Interview') return 'Interview'
  if (t === 'Lab') return 'Lab'
  if (t === 'Reading') return 'Reading'
  return 'Recording'
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
  /** Quiz-only: question text + MCQ options + correct index */
  quizQuestions?: Array<{ id: string; title: string; options: string[]; correctOptionIndex?: number }>
  /** Quiz-only: Tutor-style timing, attempts, layout, etc. */
  quizSettings?: QuizSettingsDraft
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
  if (t.lessonVideoRecordingRef) return 'recording'
  return 'none'
}

function recordingOptionsForLesson(mod: CurriculumModule, currentTopicId: string) {
  const opts: { value: string; label: string }[] = []
  if (mod.recordingFile) {
    opts.push({ value: '__module__', label: 'Module recording (file on this module)' })
  }
  for (const top of mod.topics) {
    if (top.id === currentTopicId) continue
    if (top.type !== 'Recording') continue
    if (top.recordingFile || top.recordingNote.trim() || top.title.trim()) {
      opts.push({ value: top.id, label: top.title.trim() || 'Recording topic' })
    }
  }
  return opts
}

const CATEGORIES = ['Technical', 'Non-Technical']
const COURSES = ['B.Tech', 'Diploma', 'BA', 'BSc', 'BCom', 'BBA', 'BCA']
const STREAMS = ['CSE', 'Civil', 'Electrical', 'ECE', 'Mechanical', 'IT']
const MODES = ['Online', 'Offline', 'Hybrid']
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const

const MARKETING_CATEGORIES = [
  'Business',
  'Design',
  'Development',
  'Featured',
  'Health & Fitness',
  'Technical',
  'Career readiness',
  'Soft skills',
] as const

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

export function AddTraining() {
  const navigate = useNavigate()
  const authUser = useAuthStore((s) => s.user)
  const slugTouched = useRef(false)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [basic, setBasic] = useState({
    title: '',
    slug: '',
    category: '',
    universities: [] as string[],
    courses: [] as string[],
    streams: [] as string[],
    mode: [] as string[],
    durationValue: '',
    durationUnit: 'weeks',
    fee: '',
    originalPrice: '',
    pricingFree: false,
    shortDesc: '',
    fullDesc: '',
    trainerName: '',
    difficulty: 'Intermediate',
    featuredImageUrl: '',
    introVideoUrl: '',
    thumbnail: null as File | null,
    listingVisibility: 'public' as 'public' | 'unlisted',
    scheduleEnabled: false,
    scheduleDate: '',
    scheduleTime: '',
    marketingCategories: [] as string[],
    marketingCategoryFilter: '',
    trainingTags: '',
  })
  const [additional, setAdditional] = useState({
    whatYouWillLearn: '',
    targetAudience: '',
    materialsIncluded: '',
    instructions: '',
  })
  const [batches, setBatches] = useState<Array<{ name: string; startDate: string; endDate: string; maxSeats: string; mode: string }>>([
    { name: '', startDate: '', endDate: '', maxSeats: '', mode: 'Online' },
  ])
  const [curriculum, setCurriculum] = useState<CurriculumModule[]>([])
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [quizEditor, setQuizEditor] = useState<{ moduleId: string; topicId: string } | null>(null)
  const [lessonEditor, setLessonEditor] = useState<{ moduleId: string; topicId: string } | null>(null)

  const addBatch = () => {
    setBatches((b) => [...b, { name: '', startDate: '', endDate: '', maxSeats: '', mode: 'Online' }])
  }
  const removeBatch = (i: number) => {
    if (batches.length > 1) setBatches((b) => b.filter((_, idx) => idx !== i))
  }
  const updateBatch = (i: number, field: string, value: string) => {
    setBatches((b) => b.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  }

  const genId = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const addModule = () => {
    const id = genId()
    setCurriculum((c) => [...c, { id, title: '', order: c.length, topics: [], recordingFile: null }])
    setExpandedModules((s) => new Set([...s, id]))
  }

  const updateModule = (moduleId: string, field: 'title', value: string) => {
    setCurriculum((c) => c.map((m) => (m.id === moduleId ? { ...m, [field]: value } : m)))
  }

  const setModuleRecording = (moduleId: string, file: File | null) => {
    setCurriculum((c) => c.map((m) => (m.id === moduleId ? { ...m, recordingFile: file } : m)))
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

  const setTopicRecordingFile = (moduleId: string, topicId: string, file: File | null) => {
    setCurriculum((c) =>
      c.map((m) =>
        m.id === moduleId
          ? { ...m, topics: m.topics.map((t) => (t.id === topicId ? { ...t, recordingFile: file } : t)) }
          : m
      )
    )
  }

  const removeTopic = (moduleId: string, topicId: string) => {
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

  const buildPayload = (publish: boolean) => {
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
      })),
    }))
    const plainShort = plainTextFromHtml(basic.shortDesc)
    const plainFull = plainTextFromHtml(basic.fullDesc)
    const metaDescription = (plainFull || plainShort).slice(0, 4000)
    return {
      title: basic.title.trim(),
      slug: basic.slug.trim() || undefined,
      description: metaDescription,
      shortDescription: basic.shortDesc.trim(),
      fullDescription: basic.fullDesc.trim(),
      category: basic.category,
      universities: basic.universities,
      courses: basic.courses,
      streams: basic.streams,
      mode: basic.mode,
      durationValue: basic.durationValue,
      durationUnit: basic.durationUnit,
      duration: durationStr,
      fee: priceNum,
      price: priceNum,
      originalPrice: origNum > 0 ? origNum : undefined,
      trainerName: basic.trainerName.trim(),
      difficulty: basic.difficulty,
      featuredImageUrl: basic.featuredImageUrl.trim() || undefined,
      introVideoUrl: basic.introVideoUrl.trim() || undefined,
      listingVisibility: basic.listingVisibility,
      scheduledPublishAt:
        basic.scheduleEnabled && basic.scheduleDate.trim()
          ? toScheduledIso(basic.scheduleDate, basic.scheduleTime)
          : undefined,
      marketingCategories: basic.marketingCategories.length ? basic.marketingCategories : undefined,
      whatYouWillLearn: linesToList(additional.whatYouWillLearn),
      targetAudience: additional.targetAudience.trim(),
      materialsIncluded: linesToList(additional.materialsIncluded),
      instructions: additional.instructions.trim(),
      trainingTags: tagsToList(basic.trainingTags),
      batches: batches.map((b) => ({
        name: b.name,
        startDate: b.startDate,
        endDate: b.endDate,
        maxSeats: b.maxSeats,
        mode: b.mode,
      })),
      curriculum: curriculumSerial,
      active: publish,
    }
  }

  const validateForPublish = (): string | null => {
    if (!basic.title.trim()) return 'Training title is required.'
    if (!basic.category) return 'Category is required.'
    if (!basic.universities.length) return 'Select at least one university.'
    if (!basic.courses.length) return 'Select at least one applicable course.'
    if ((basic.courses.includes('B.Tech') || basic.courses.includes('Diploma')) && !basic.streams.length) {
      return 'Select at least one stream for B.Tech / Diploma.'
    }
    if (!basic.mode.length) return 'Select at least one mode.'
    if (!basic.durationValue.trim() || parseInt(basic.durationValue, 10) < 1) return 'Duration value is required.'
    if (!basic.trainerName.trim()) return 'Trainer name is required.'
    if (!basic.pricingFree && (!basic.fee.trim() || parseInt(basic.fee, 10) < 0)) return 'Enter a valid training fee or mark as free.'
    const sd = plainTextFromHtml(basic.shortDesc)
    if (sd.length < 20 || sd.length > 300) return 'Short summary (plain text) must be 20–300 characters.'
    const fd = plainTextFromHtml(basic.fullDesc)
    if (fd.length < 100) return 'Full description (plain text) must be at least 100 characters.'
    const badBatch = batches.find((b) => !b.name.trim() || !b.startDate || !b.endDate || !b.maxSeats.trim())
    if (badBatch) return 'Each batch needs name, start date, end date, and max seats.'
    if (!curriculum.length) return 'Add at least one curriculum module before publishing.'
    if (curriculum.some((m) => m.topics.some((t) => t.isCurriculumDraft))) {
      return 'Finish new curriculum topics (click Ok on each title/summary card) or cancel them before publishing.'
    }
    const badMod = curriculum.find((m) => !m.title.trim() || m.topics.some((t) => !t.title.trim()))
    if (badMod) return 'Each module needs a title; each topic needs a title.'
    return null
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
      const payload = buildPayload(false)
      await adminService.createCourse(payload)
      navigate('/admin/courses', { replace: true })
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
      const payload = buildPayload(true)
      await adminService.createCourse(payload)
      navigate('/admin/courses', { replace: true })
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

  return (
    <div className="mx-auto w-full max-w-[min(100%,88rem)] space-y-6 px-0 sm:px-1">
      <div className="flex items-center gap-4">
        <Link to="/admin/courses" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold text-brand-navy">Add New Training</h2>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

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
                hint="Shown on cards and the course hero. Use bold/lists for emphasis (20–300 characters of plain text)."
                value={basic.shortDesc}
                onChange={(html) => setBasic((b) => ({ ...b, shortDesc: html }))}
                placeholder="Brief summary for listings…"
                minHeightClass="min-h-[100px]"
              />
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
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{d}</option>
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
                    onChange={(e) => setBasic((b) => ({
                      ...b,
                      universities: Array.from(e.target.selectedOptions, (o) => o.value),
                    }))}
                    className="mt-1 w-full min-h-[100px] rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                    title="Select one or more universities"
                  >
                    <option disabled value="">
                      — Select one or more universities —
                    </option>
                    {UNIVERSITIES_LIST.map((u) => (
                      <option key={u.name} value={u.name}>{u.shortForm} — {u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Applicable Course(s) *</label>
                  <p className="mt-0.5 text-xs text-slate-500">Select one or more courses</p>
                  <select
                    multiple
                    value={basic.courses}
                    onChange={(e) => setBasic((b) => ({
                      ...b,
                      courses: Array.from(e.target.selectedOptions, (o) => o.value),
                    }))}
                    className="mt-1 w-full min-h-[100px] rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                    title="Select one or more courses"
                  >
                    <option disabled value="">
                      — Select one or more courses —
                    </option>
                    {COURSES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(basic.courses.includes('B.Tech') || basic.courses.includes('Diploma')) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stream(s) *</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STREAMS.map((s) => (
                      <label key={s} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={basic.streams.includes(s)}
                          onChange={(e) => setBasic((b) => ({
                            ...b,
                            streams: e.target.checked ? [...b.streams, s] : b.streams.filter((x) => x !== s),
                          }))}
                          className="rounded text-brand-accent"
                        />
                        <span className="text-sm">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
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
                    <option value="days">Days</option>
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
                <p className="mt-0.5 text-xs text-slate-500">URL or upload (JPEG, PNG; keep under ~2MB for fast loads).</p>
                <input
                  type="url"
                  value={basic.featuredImageUrl}
                  onChange={(e) => setBasic((b) => ({ ...b, featuredImageUrl: e.target.value }))}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif"
                  onChange={(e) => setBasic((b) => ({ ...b, thumbnail: e.target.files?.[0] ?? null }))}
                  className="mt-2 w-full text-xs text-gray-600"
                />
                {basic.thumbnail ? (
                  <p className="mt-1 text-xs text-slate-600 truncate" title={basic.thumbnail.name}>{basic.thumbnail.name}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Intro video</label>
                <p className="mt-0.5 text-xs text-slate-500">Paste a YouTube / Vimeo URL for the course preview.</p>
                <input
                  type="url"
                  value={basic.introVideoUrl}
                  onChange={(e) => setBasic((b) => ({ ...b, introVideoUrl: e.target.value }))}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
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
                <label className="block text-sm font-medium text-gray-700">Marketing categories</label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={basic.marketingCategoryFilter}
                    onChange={(e) => setBasic((b) => ({ ...b, marketingCategoryFilter: e.target.value }))}
                    placeholder="Search…"
                    className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm"
                  />
                </div>
                <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 text-sm">
                  {MARKETING_CATEGORIES.filter(
                    (c) =>
                      !basic.marketingCategoryFilter.trim()
                      || c.toLowerCase().includes(basic.marketingCategoryFilter.trim().toLowerCase()),
                  ).map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2 py-0.5">
                      <input
                        type="checkbox"
                        checked={basic.marketingCategories.includes(c)}
                        onChange={() =>
                          setBasic((b) => ({
                            ...b,
                            marketingCategories: b.marketingCategories.includes(c)
                              ? b.marketingCategories.filter((x) => x !== c)
                              : [...b.marketingCategories, c],
                          }))
                        }
                        className="rounded text-brand-accent"
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
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
                <span className="font-medium text-gray-800">Author</span>
                <p className="mt-1">
                  {authUser?.name || '—'}
                  {authUser?.email ? <span className="block text-slate-500">{authUser.email}</span> : null}
                </p>
                <p className="mt-1 text-slate-400">Saved on the course when you publish.</p>
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
            Add modules, then use <strong className="text-gray-800">Add topic</strong> for a Tutor-style card (title, summary, Cancel / Ok). After Ok, choose lesson, quiz, lab, and other types. Recording topics and module recordings can be linked from the lesson video sidebar.
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
                      {/* Module-level: choose recording from system */}
                      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 sm:p-4">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          <Video className="h-3.5 w-3.5 inline mr-1" /> Module recording (optional)
                        </label>
                        <p className="text-xs text-slate-500 mb-2">Choose a video or audio file for this module.</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="video/*,audio/*,.mp4,.webm,.mp3,.wav,.m4a"
                            onChange={(e) => setModuleRecording(mod.id, e.target.files?.[0] ?? null)}
                            className="text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-brand-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white file:cursor-pointer hover:file:bg-primary-600"
                          />
                          {mod.recordingFile && (
                            <span className="text-xs text-slate-600 truncate max-w-[200px]" title={mod.recordingFile.name}>
                              {mod.recordingFile.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Topics — Tutor-style wide cards, type as button row (same stored types) */}
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
                                            setQuizEditor({ moduleId: mod.id, topicId: topic.id })
                                          } else if (t === 'Lecture') {
                                            setQuizEditor(null)
                                            setLessonEditor({ moduleId: mod.id, topicId: topic.id })
                                          } else {
                                            if (quizEditor?.moduleId === mod.id && quizEditor?.topicId === topic.id) {
                                              setQuizEditor(null)
                                            }
                                            if (lessonEditor?.moduleId === mod.id && lessonEditor?.topicId === topic.id) {
                                              setLessonEditor(null)
                                            }
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
                                        {isProTopicType(t) ? (
                                          <span className="ml-0.5 rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold uppercase leading-none text-white">
                                            Pro
                                          </span>
                                        ) : null}
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
                                          setLessonEditor({ moduleId: mod.id, topicId: topic.id })
                                        }}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-accent bg-white px-3 py-2 text-xs font-semibold text-brand-accent shadow-sm hover:bg-blue-50"
                                      >
                                        <BookOpen className="h-3.5 w-3.5" />
                                        Open lesson builder
                                      </button>
                                    </div>
                                  ) : null}
                                  {topic.type === 'Quiz' ? (
                                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5">
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-brand-navy">Quiz questions</p>
                                        <p className="text-xs text-gray-600">
                                          {(topic.quizQuestions?.length ?? 0) === 0
                                            ? 'No questions yet.'
                                            : `${topic.quizQuestions?.length} question(s); each can mark one correct option.`}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLessonEditor(null)
                                          setQuizEditor({ moduleId: mod.id, topicId: topic.id })
                                        }}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-500/40 bg-white px-3 py-2 text-xs font-semibold text-violet-900 shadow-sm hover:bg-violet-50"
                                      >
                                        <ClipboardList className="h-3.5 w-3.5" />
                                        Open quiz builder
                                      </button>
                                    </div>
                                  ) : null}
                                  {isProTopicType(topic.type) ? (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-900">
                                      <span className="font-bold uppercase tracking-wide">Pro</span>
                                      {' '}
                                      — Advanced delivery, grading, and analytics for this topic type can be enabled for your workspace tier.
                                    </div>
                                  ) : null}
                                </div>
                                {topic.type === 'Recording' && (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2 sm:p-4">
                                    <p className="text-xs font-medium text-amber-800">Video / audio or note for this recording</p>
                                    <div>
                                      <label className="mb-1 block text-xs text-gray-600">Choose video or audio from system</label>
                                      <input
                                        type="file"
                                        accept="video/*,audio/*,.mp4,.webm,.mp3,.wav,.m4a"
                                        onChange={(e) => setTopicRecordingFile(mod.id, topic.id, e.target.files?.[0] ?? null)}
                                        className="text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white file:cursor-pointer"
                                      />
                                      {topic.recordingFile ? (
                                        <span className="ml-2 text-xs text-slate-600">{topic.recordingFile.name}</span>
                                      ) : null}
                                    </div>
                                    <div>
                                      <label className="mb-1 flex items-center gap-1 text-xs text-gray-600">
                                        <FileText className="h-3.5 w-3.5" /> Note (optional)
                                      </label>
                                      <textarea
                                        value={topic.recordingNote}
                                        onChange={(e) => updateTopic(mod.id, topic.id, 'recordingNote', e.target.value)}
                                        placeholder="Add a note or description for this recording..."
                                        rows={2}
                                        className="w-full resize-y rounded border border-gray-300 px-2 py-1.5 text-sm"
                                      />
                                    </div>
                                  </div>
                                )}
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
            <p className="text-sm text-slate-gray mt-1">Batches, learning outcomes, audience, materials, and instructions appear on the public course page.</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-800">Batches *</h4>
            {batches.map((batch, i) => (
              <div key={i} className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 p-4">
                <div className="min-w-[120px] flex-1">
                  <label className="block text-xs font-medium text-gray-600">Batch Name</label>
                  <input
                    value={batch.name}
                    onChange={(e) => updateBatch(i, 'name', e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Start Date</label>
                  <input
                    type="date"
                    value={batch.startDate}
                    onChange={(e) => updateBatch(i, 'startDate', e.target.value)}
                    className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">End Date</label>
                  <input
                    type="date"
                    value={batch.endDate}
                    onChange={(e) => updateBatch(i, 'endDate', e.target.value)}
                    className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-600">Max Seats</label>
                  <input
                    type="number"
                    min={1}
                    value={batch.maxSeats}
                    onChange={(e) => updateBatch(i, 'maxSeats', e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Mode</label>
                  <select
                    value={batch.mode}
                    onChange={(e) => updateBatch(i, 'mode', e.target.value)}
                    className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => removeBatch(i)} className="rounded p-2 text-red-600 hover:bg-red-50">
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={addBatch} className="text-sm font-medium text-brand-accent hover:underline">
              + Add Batch
            </button>
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
              <label className="block text-sm font-medium text-gray-700">Who is this course for?</label>
              <p className="text-xs text-slate-500 mt-0.5">One bullet per line (shown as a list on the course page).</p>
              <textarea
                rows={3}
                value={additional.targetAudience}
                onChange={(e) => setAdditional((a) => ({ ...a, targetAudience: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Materials included</label>
              <p className="text-xs text-slate-500 mt-0.5">One item per line.</p>
              <textarea
                rows={3}
                value={additional.materialsIncluded}
                onChange={(e) => setAdditional((a) => ({ ...a, materialsIncluded: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Instructions</label>
              <textarea
                rows={2}
                value={additional.instructions}
                onChange={(e) => setAdditional((a) => ({ ...a, instructions: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. Laptop required, install Python 3.11+"
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
          recordingOptions={recordingOptionsForLesson(lessonEditorModule, lessonEditorTopic.id)}
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
