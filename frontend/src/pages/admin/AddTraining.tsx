/**
 * Admin — Add New Training (AD-WF-03). 3-step: Basic Details → Batch Config → Curriculum Builder.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Send, Plus, Trash2, ChevronDown, ChevronRight, Video, FileText } from 'lucide-react'
import { UNIVERSITIES_LIST } from '@/constants/universities'
import { adminService } from '@/services/adminService'

const TOPIC_TYPES = ['Lecture', 'Lab', 'Assignment', 'Quiz', 'Reading', 'Recording'] as const
type TopicType = (typeof TOPIC_TYPES)[number]

interface CurriculumTopic {
  id: string
  title: string
  type: TopicType
  details: string
  recordingFile: File | null
  recordingNote: string
}

interface CurriculumModule {
  id: string
  title: string
  order: number
  topics: CurriculumTopic[]
  recordingFile: File | null
}

const CATEGORIES = ['Technical', 'Non-Technical']
const COURSES = ['B.Tech', 'Diploma', 'BA', 'BSc', 'BCom', 'BBA', 'BCA']
const STREAMS = ['CSE', 'Civil', 'Electrical', 'ECE', 'Mechanical', 'IT']
const MODES = ['Online', 'Offline', 'Hybrid']

export function AddTraining() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [basic, setBasic] = useState({
    title: '',
    category: '',
    universities: [] as string[],
    courses: [] as string[],
    streams: [] as string[],
    mode: [] as string[],
    durationValue: '',
    durationUnit: 'weeks',
    fee: '',
    shortDesc: '',
    fullDesc: '',
    trainerName: '',
    thumbnail: null as File | null,
  })
  const [batches, setBatches] = useState<Array<{ name: string; startDate: string; endDate: string; maxSeats: string; mode: string }>>([
    { name: '', startDate: '', endDate: '', maxSeats: '', mode: 'Online' },
  ])
  const [curriculum, setCurriculum] = useState<CurriculumModule[]>([])
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

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
    const topic: CurriculumTopic = { id: genId(), title: '', type: 'Lecture', details: '', recordingFile: null, recordingNote: '' }
    setCurriculum((c) => c.map((m) => (m.id === moduleId ? { ...m, topics: [...m.topics, topic] } : m)))
  }

  const updateTopic = (moduleId: string, topicId: string, field: 'title' | 'type' | 'details' | 'recordingNote', value: string) => {
    setCurriculum((c) =>
      c.map((m) =>
        m.id === moduleId
          ? { ...m, topics: m.topics.map((t) => (t.id === topicId ? { ...t, [field]: value } : t)) }
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

  const buildPayload = (publish: boolean) => {
    const durationVal = basic.durationValue.trim()
    const durationStr = durationVal ? `${durationVal} ${basic.durationUnit}` : ''
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
        recordingFileName: t.recordingFile?.name ?? null,
        recordingNote: t.recordingNote,
      })),
    }))
    return {
      title: basic.title.trim(),
      description: basic.fullDesc.trim() || basic.shortDesc.trim(),
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
      fee: basic.fee ? parseInt(basic.fee, 10) : 0,
      price: basic.fee ? parseInt(basic.fee, 10) : 0,
      trainerName: basic.trainerName.trim(),
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

  const handleSaveDraft = async () => {
    if (!basic.title.trim()) {
      setError('Training title is required.')
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
    if (!basic.title.trim()) {
      setError('Training title is required.')
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

  return (
    <div className="space-y-6 w-full max-w-4xl">
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
            {s === 1 ? 'Basic Details' : s === 2 ? 'Batches' : 'Curriculum'}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-brand-navy">Step 1 — Basic Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Training Title *</label>
              <input
                type="text"
                value={basic.title}
                onChange={(e) => setBasic((b) => ({ ...b, title: e.target.value }))}
                placeholder="Min 5, max 150 characters"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
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
            {(basic.courses.includes('B.Tech') || basic.courses.includes('Diploma')) && (
              <div className="sm:col-span-2">
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
            <div className="flex gap-2">
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
              <label className="block text-sm font-medium text-gray-700">Training Fee (₹) *</label>
              <input
                type="number"
                min={0}
                value={basic.fee}
                onChange={(e) => setBasic((b) => ({ ...b, fee: e.target.value }))}
                placeholder="0 for free"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Short Description (20–300 chars) *</label>
              <textarea
                rows={2}
                value={basic.shortDesc}
                onChange={(e) => setBasic((b) => ({ ...b, shortDesc: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Full Description (min 100 chars) *</label>
              <textarea
                rows={4}
                value={basic.fullDesc}
                onChange={(e) => setBasic((b) => ({ ...b, fullDesc: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
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
            <div>
              <label className="block text-sm font-medium text-gray-700">Thumbnail (JPG/PNG, max 2MB)</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={(e) => setBasic((b) => ({ ...b, thumbnail: e.target.files?.[0] ?? null }))}
                className="mt-1 w-full text-sm"
              />
            </div>
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
              Save & Continue →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-brand-navy">Step 2 — Batch Configuration</h3>
          <p className="text-sm text-slate-gray">Add at least one batch. Batch Name, Start/End Date, Max Seats, Mode.</p>
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
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              ← Back
            </button>
            <button type="button" onClick={() => setStep(3)} className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
              Continue to Curriculum →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-brand-navy">Step 3 — Curriculum Builder</h3>
          <p className="text-sm text-slate-gray">Add modules and topics. You can attach a recording to each module. For each topic add details; if the type is Recording, add video/audio or a note from the system.</p>

          <div className="space-y-3">
            {curriculum.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center text-slate-gray text-sm">
                <p>No modules yet. Click &quot;Add Module&quot; to add your first module, then add topics inside it.</p>
              </div>
            ) : (
              curriculum.map((mod, modIndex) => (
                <div key={mod.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <button
                      type="button"
                      onClick={() => toggleModuleExpanded(mod.id)}
                      className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                      aria-label={expandedModules.has(mod.id) ? 'Collapse' : 'Expand'}
                    >
                      {expandedModules.has(mod.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <span className="text-xs font-medium text-gray-500 w-8">M{modIndex + 1}</span>
                    <input
                      type="text"
                      value={mod.title}
                      onChange={(e) => updateModule(mod.id, 'title', e.target.value)}
                      placeholder="Module title"
                      className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm bg-white min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => removeModule(mod.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Remove module"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {expandedModules.has(mod.id) && (
                    <div className="p-3 space-y-4">
                      {/* Module-level: choose recording from system */}
                      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
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

                      {/* Topics */}
                      <div className="space-y-3">
                        {mod.topics.map((topic, topicIndex) => (
                          <div key={topic.id} className="rounded-lg border border-gray-200 p-3 space-y-2 bg-white">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-slate-500 w-6">{topicIndex + 1}.</span>
                              <input
                                type="text"
                                value={topic.title}
                                onChange={(e) => updateTopic(mod.id, topic.id, 'title', e.target.value)}
                                placeholder="Topic title"
                                className="flex-1 min-w-[120px] rounded border border-gray-300 px-2 py-1.5 text-sm"
                              />
                              <select
                                value={topic.type}
                                onChange={(e) => updateTopic(mod.id, topic.id, 'type', e.target.value)}
                                className="rounded border border-gray-300 px-2 py-1.5 text-sm w-32"
                              >
                                {TOPIC_TYPES.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeTopic(mod.id, topic.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title="Remove topic"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="pl-6">
                              <label className="block text-xs font-medium text-gray-600 mb-0.5">Details</label>
                              <textarea
                                value={topic.details}
                                onChange={(e) => updateTopic(mod.id, topic.id, 'details', e.target.value)}
                                placeholder="Topic description or instructions..."
                                rows={2}
                                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm resize-y"
                              />
                            </div>
                            {topic.type === 'Recording' && (
                              <div className="pl-6 rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                                <p className="text-xs font-medium text-amber-800">Video / audio or note for this recording</p>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Choose video or audio from system</label>
                                  <input
                                    type="file"
                                    accept="video/*,audio/*,.mp4,.webm,.mp3,.wav,.m4a"
                                    onChange={(e) => setTopicRecordingFile(mod.id, topic.id, e.target.files?.[0] ?? null)}
                                    className="text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white file:cursor-pointer"
                                  />
                                  {topic.recordingFile && (
                                    <span className="ml-2 text-xs text-slate-600">{topic.recordingFile.name}</span>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" /> Note (optional)
                                  </label>
                                  <textarea
                                    value={topic.recordingNote}
                                    onChange={(e) => updateTopic(mod.id, topic.id, 'recordingNote', e.target.value)}
                                    placeholder="Add a note or description for this recording..."
                                    rows={2}
                                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm resize-y"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addTopic(mod.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 ml-6"
                        >
                          <Plus className="h-4 w-4" /> Add Topic
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

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Save as Draft
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
    </div>
  )
}
