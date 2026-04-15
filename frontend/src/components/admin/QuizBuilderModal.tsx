import { useCallback, useEffect, useState } from 'react'
import { X, ClipboardList, Plus, Trash2, ChevronDown, ChevronRight, Info, Eye } from 'lucide-react'

export type QuizQuestionDraft = { id: string; title: string; options: string[]; correctOptionIndex: number }

function normalizeQuizQuestion(q: QuizQuestionDraft | { id: string; title: string }): QuizQuestionDraft {
  const opts =
    'options' in q && Array.isArray(q.options) ? q.options.map((o) => String(o ?? '')) : []
  const options = opts.length >= 2 ? [...opts] : [...opts, '', '']
  while (options.length < 2) options.push('')
  let correct =
    'correctOptionIndex' in q && typeof (q as QuizQuestionDraft).correctOptionIndex === 'number'
      ? Math.floor(Number((q as QuizQuestionDraft).correctOptionIndex))
      : 0
  if (correct < 0 || correct >= options.length) correct = 0
  return { id: q.id, title: typeof q.title === 'string' ? q.title : '', options, correctOptionIndex: correct }
}

export type QuizTimeUnit = 'Minutes' | 'Hours' | 'Seconds'

export type QuizFeedbackMode = 'retry' | 'reveal' | 'default'

export type QuizQuestionLayout = 'single_question' | 'multiple'

export type QuizQuestionOrder = 'sort' | 'random'

export type QuizSettingsDraft = {
  timeLimitValue: string
  timeLimitUnit: QuizTimeUnit
  hideQuizTime: boolean
  feedbackMode: QuizFeedbackMode
  attemptsAllowed: string
  passingGradePercent: string
  maxQuestionsToAnswer: string
  quizAutoStart: boolean
  questionLayout: QuizQuestionLayout
  questionOrder: QuizQuestionOrder
  hideQuestionNumber: boolean
  shortAnswerCharLimit: string
  essayCharLimit: string
}

export function defaultQuizSettings(): QuizSettingsDraft {
  return {
    timeLimitValue: '0',
    timeLimitUnit: 'Minutes',
    hideQuizTime: false,
    feedbackMode: 'retry',
    attemptsAllowed: '10',
    passingGradePercent: '80',
    maxQuestionsToAnswer: '10',
    quizAutoStart: false,
    questionLayout: 'single_question',
    questionOrder: 'random',
    hideQuestionNumber: false,
    shortAnswerCharLimit: '200',
    essayCharLimit: '500',
  }
}

function normalizeQuizSettings(input: Partial<QuizSettingsDraft> | undefined): QuizSettingsDraft {
  const d = defaultQuizSettings()
  if (!input) return d
  return {
    timeLimitValue: input.timeLimitValue ?? d.timeLimitValue,
    timeLimitUnit: input.timeLimitUnit ?? d.timeLimitUnit,
    hideQuizTime: input.hideQuizTime ?? d.hideQuizTime,
    feedbackMode: input.feedbackMode ?? d.feedbackMode,
    attemptsAllowed: input.attemptsAllowed ?? d.attemptsAllowed,
    passingGradePercent: input.passingGradePercent ?? d.passingGradePercent,
    maxQuestionsToAnswer: input.maxQuestionsToAnswer ?? d.maxQuestionsToAnswer,
    quizAutoStart: input.quizAutoStart ?? d.quizAutoStart,
    questionLayout: input.questionLayout ?? d.questionLayout,
    questionOrder: input.questionOrder ?? d.questionOrder,
    hideQuestionNumber: input.hideQuestionNumber ?? d.hideQuestionNumber,
    shortAnswerCharLimit: input.shortAnswerCharLimit ?? d.shortAnswerCharLimit,
    essayCharLimit: input.essayCharLimit ?? d.essayCharLimit,
  }
}

export type QuizTopicDraft = {
  title: string
  summary: string
  questions: QuizQuestionDraft[]
  settings: QuizSettingsDraft
}

type QuizBuilderModalProps = {
  open: boolean
  moduleTitle: string
  topicLabel: string
  initialTitle: string
  initialSummary: string
  initialQuestions: Array<QuizQuestionDraft | { id: string; title: string; options?: string[]; correctOptionIndex?: number }>
  initialSettings?: Partial<QuizSettingsDraft>
  onClose: () => void
  onSave: (draft: QuizTopicDraft) => void
}

function FieldHint({ text }: { text: string }) {
  return (
    <span className="inline-flex text-gray-400" title={text}>
      <Info className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{text}</span>
    </span>
  )
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        {label}
        {hint ? <FieldHint text={hint} /> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-accent' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function newQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function QuizBuilderModal({
  open,
  moduleTitle,
  topicLabel,
  initialTitle,
  initialSummary,
  initialQuestions,
  initialSettings,
  onClose,
  onSave,
}: QuizBuilderModalProps) {
  const [tab, setTab] = useState<'details' | 'settings'>('details')
  const [title, setTitle] = useState(initialTitle)
  const [summary, setSummary] = useState(initialSummary)
  const [questions, setQuestions] = useState<QuizQuestionDraft[]>(() =>
    initialQuestions.length ? initialQuestions.map(normalizeQuizQuestion) : []
  )
  const [settings, setSettings] = useState<QuizSettingsDraft>(() => normalizeQuizSettings(initialSettings))
  const [basicOpen, setBasicOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const topicLine = topicLabel.trim() || 'Untitled topic'

  useEffect(() => {
    if (!open) return
    setTab('details')
    setTitle(initialTitle)
    setSummary(initialSummary)
    setQuestions(initialQuestions.length ? initialQuestions.map(normalizeQuizQuestion) : [])
    setSettings(normalizeQuizSettings(initialSettings))
    setBasicOpen(true)
    setAdvancedOpen(true)
    setSelectedId(null)
  }, [open, initialTitle, initialSummary, initialQuestions, initialSettings])

  const selected = questions.find((q) => q.id === selectedId) ?? null

  const addQuestion = useCallback(() => {
    const id = newQuestionId()
    setQuestions((prev) => [...prev, { id, title: '', options: ['', ''], correctOptionIndex: 0 }])
    setSelectedId(id)
  }, [])

  const updateSelectedTitle = (value: string) => {
    if (!selectedId) return
    setQuestions((prev) => prev.map((q) => (q.id === selectedId ? { ...q, title: value } : q)))
  }

  const updateSelectedOption = (index: number, value: string) => {
    if (!selectedId) return
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== selectedId) return q
        const next = [...q.options]
        next[index] = value
        return { ...q, options: next }
      })
    )
  }

  const addOptionRow = () => {
    if (!selectedId) return
    setQuestions((prev) =>
      prev.map((q) => (q.id === selectedId ? { ...q, options: [...q.options, ''] } : q))
    )
  }

  const removeOptionRow = (index: number) => {
    if (!selectedId) return
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== selectedId || q.options.length <= 2) return q
        const nextOpts = q.options.filter((_, i) => i !== index)
        let correct = q.correctOptionIndex
        if (index === correct) correct = 0
        else if (index < correct) correct = Math.max(0, correct - 1)
        correct = Math.min(correct, nextOpts.length - 1)
        return { ...q, options: nextOpts, correctOptionIndex: correct }
      })
    )
  }

  const setCorrectOptionIndex = (index: number) => {
    if (!selectedId) return
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== selectedId) return q
        const safe = Math.min(Math.max(0, index), q.options.length - 1)
        return { ...q, correctOptionIndex: safe }
      })
    )
  }

  const handleSave = () => {
    onSave({ title: title.trim(), summary: summary.trim(), questions, settings })
  }

  const patchSettings = <K extends keyof QuizSettingsDraft>(key: K, value: QuizSettingsDraft[K]) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  if (!open) return null

  const hasTitle = title.trim().length > 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close quiz builder"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-builder-title"
        className="relative flex max-h-[min(92vh,880px)] w-full max-w-[min(96vw,1180px)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardList className="h-5 w-5 shrink-0 text-brand-accent" aria-hidden />
            <div className="min-w-0">
              <h2 id="quiz-builder-title" className="text-base font-semibold text-brand-navy sm:text-lg">
                Quiz
              </h2>
              <p className="truncate text-xs text-gray-500 sm:text-sm">
                Topic: <span className="font-medium text-gray-700">{topicLine}</span>
                <span className="text-gray-400"> · </span>
                <span className="text-gray-500">{moduleTitle || 'Module'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Quiz sections">
              <button
                type="button"
                onClick={() => setTab('details')}
                className={`border-b-2 px-2 py-1 text-sm font-semibold transition ${
                  tab === 'details' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Question Details
              </button>
              <button
                type="button"
                onClick={() => setTab('settings')}
                className={`border-b-2 px-2 py-1 text-sm font-semibold transition ${
                  tab === 'settings' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Settings
              </button>
            </nav>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col sm:hidden">
          <nav className="flex border-b border-gray-100 px-3" aria-label="Quiz sections">
            <button
              type="button"
              onClick={() => setTab('details')}
              className={`flex-1 border-b-2 py-2 text-center text-sm font-semibold ${
                tab === 'details' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-gray-500'
              }`}
            >
              Question Details
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`flex-1 border-b-2 py-2 text-center text-sm font-semibold ${
                tab === 'settings' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-gray-500'
              }`}
            >
              Settings
            </button>
          </nav>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {tab === 'details' ? (
            <>
              <aside className="flex w-full shrink-0 flex-col border-gray-200 bg-gray-50/80 p-4 sm:p-5 lg:w-[280px] lg:border-r">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add quiz title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-brand-navy focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                  placeholder="Enter quiz title"
                  autoFocus
                />
                <label className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Add a summary</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={6}
                  className="mt-1.5 min-h-[120px] w-full flex-1 resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                  placeholder="Short description for learners…"
                />
                <div className="mt-4 flex justify-end gap-2 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
                  >
                    Ok
                  </button>
                </div>
              </aside>

              <section className="flex min-h-[200px] min-w-0 flex-1 flex-col border-gray-200 bg-white p-4 sm:p-6 lg:border-r">
                {!hasTitle ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-10 text-center">
                    <div className="rounded-full bg-gray-200/80 p-6 text-gray-400">
                      <ClipboardList className="h-14 w-14" strokeWidth={1.25} />
                    </div>
                    <p className="mt-6 max-w-md text-sm leading-relaxed text-gray-600">
                      Enter a quiz title to begin. Choose from a variety of question types to keep things interesting!
                    </p>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-brand-navy">Questions</h3>
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-accent bg-white px-3 py-1.5 text-xs font-semibold text-brand-accent hover:bg-blue-50"
                      >
                        + Add question
                      </button>
                    </div>
                    <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {questions.length === 0 ? (
                        <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500">
                          No questions yet. Use &quot;Add question&quot; to start.
                        </li>
                      ) : (
                        questions.map((q) => (
                          <li key={q.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(q.id)}
                              className={`flex w-full flex-col items-stretch rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                                selectedId === q.id
                                  ? 'border-brand-accent bg-blue-50 font-medium text-brand-navy ring-1 ring-brand-accent/20'
                                  : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <span className="block truncate">{q.title.trim() || 'Untitled question'}</span>
                              <span className="mt-0.5 block text-[11px] font-normal text-gray-500">
                                {q.options.filter((o) => o.trim()).length || q.options.length} option(s) · correct #{q.correctOptionIndex + 1}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                    {selected ? (
                      <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50/90 p-3 lg:hidden">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Question</p>
                        <div>
                          <label className="text-xs text-gray-600">Question text</label>
                          <textarea
                            value={selected.title}
                            onChange={(e) => updateSelectedTitle(e.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                            placeholder="Write the question…"
                          />
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <label className="text-xs font-medium text-gray-600">Answer options</label>
                            <button
                              type="button"
                              onClick={addOptionRow}
                              className="inline-flex items-center gap-1 rounded border border-brand-accent/40 bg-white px-2 py-1 text-[11px] font-semibold text-brand-accent hover:bg-blue-50"
                            >
                              <Plus className="h-3 w-3" /> Add
                            </button>
                          </div>
                          <ul className="space-y-2">
                            {selected.options.map((opt, idx) => (
                              <li key={idx} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                                <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-medium text-gray-600" title="Mark correct answer">
                                  <input
                                    type="radio"
                                    name={`correct-${selected.id}`}
                                    checked={selected.correctOptionIndex === idx}
                                    onChange={() => setCorrectOptionIndex(idx)}
                                    className="h-3.5 w-3.5 border-gray-300 text-brand-accent focus:ring-brand-accent"
                                  />
                                  Correct
                                </label>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => updateSelectedOption(idx, e.target.value)}
                                  placeholder={`Option ${idx + 1}`}
                                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOptionRow(idx)}
                                  disabled={selected.options.length <= 2}
                                  className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                                  aria-label={`Remove option ${idx + 1}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              <aside className="hidden w-[min(100%,320px)] shrink-0 flex-col overflow-y-auto border-l border-gray-100 bg-gray-50/50 p-4 lg:flex">
                {selected ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Question</p>
                    <div>
                      <label className="text-xs text-gray-600">Question text</label>
                      <textarea
                        value={selected.title}
                        onChange={(e) => updateSelectedTitle(e.target.value)}
                        rows={4}
                        className="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                        placeholder="Write the question…"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="text-xs font-medium text-gray-600">Answer options</label>
                        <button
                          type="button"
                          onClick={addOptionRow}
                          className="inline-flex items-center gap-1 rounded border border-brand-accent/40 bg-white px-2 py-1 text-[11px] font-semibold text-brand-accent hover:bg-blue-50"
                        >
                          <Plus className="h-3 w-3" /> Add option
                        </button>
                      </div>
                      <ul className="space-y-2">
                        {selected.options.map((opt, idx) => (
                          <li key={idx} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-medium text-gray-600 whitespace-nowrap">
                                <input
                                  type="radio"
                                  name={`correct-lg-${selected.id}`}
                                  checked={selected.correctOptionIndex === idx}
                                  onChange={() => setCorrectOptionIndex(idx)}
                                  className="h-3.5 w-3.5 border-gray-300 text-brand-accent focus:ring-brand-accent"
                                />
                                Correct
                              </label>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateSelectedOption(idx, e.target.value)}
                                placeholder={`Option ${idx + 1}`}
                                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeOptionRow(idx)}
                              disabled={selected.options.length <= 2}
                              className="shrink-0 self-end rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:self-center"
                              aria-label={`Remove option ${idx + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-gray-500">Create / select a question to edit the prompt and options.</p>
                )}
              </aside>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
              <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 sm:px-6">
                <p className="text-xs text-gray-500">
                  Values are stored on this quiz topic in the course curriculum JSON. Enforcement on the student app can be wired when the quiz runtime is connected.
                </p>

                {/* Basic Settings */}
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setBasicOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-3 text-left text-sm font-semibold text-brand-navy hover:bg-gray-50"
                  >
                    Basic Settings
                    {basicOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />}
                  </button>
                  {basicOpen ? (
                    <div className="space-y-4 px-4 py-4">
                      <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                          Time Limit
                          <FieldHint text="0 means no time limit. Applies when the quiz player supports timers." />
                        </label>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={settings.timeLimitValue}
                            onChange={(e) => patchSettings('timeLimitValue', e.target.value)}
                            className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                          />
                          <select
                            value={settings.timeLimitUnit}
                            onChange={(e) => patchSettings('timeLimitUnit', e.target.value as QuizTimeUnit)}
                            className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
                          >
                            <option value="Minutes">Minutes</option>
                            <option value="Hours">Hours</option>
                            <option value="Seconds">Seconds</option>
                          </select>
                        </div>
                      </div>

                      <ToggleRow
                        id="hide-quiz-time"
                        label="Hide Quiz Time"
                        checked={settings.hideQuizTime}
                        onChange={(v) => patchSettings('hideQuizTime', v)}
                      />

                      <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">Feedback Mode</label>
                        <div className="relative mt-1.5">
                          <Eye className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
                          <select
                            value={settings.feedbackMode}
                            onChange={(e) => patchSettings('feedbackMode', e.target.value as QuizFeedbackMode)}
                            className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm"
                          >
                            <option value="retry">Retry</option>
                            <option value="reveal">Reveal answers</option>
                            <option value="default">Default (single attempt)</option>
                          </select>
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500">
                          {settings.feedbackMode === 'retry'
                            ? 'Allows students to retake the quiz after their first attempt.'
                            : settings.feedbackMode === 'reveal'
                              ? 'Show correctness and explanations after submission where available.'
                              : 'Standard flow: one graded attempt unless you change attempts below.'}
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                          Attempts Allowed
                          <FieldHint text="Maximum submissions per learner for this quiz." />
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={settings.attemptsAllowed}
                          onChange={(e) => patchSettings('attemptsAllowed', e.target.value)}
                          className="mt-1.5 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                          Passing Grade
                          <FieldHint text="Percentage required to pass the quiz." />
                        </label>
                        <div className="relative mt-1.5 max-w-xs">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={settings.passingGradePercent}
                            onChange={(e) => patchSettings('passingGradePercent', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-10 text-sm"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                            %
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                          Max Question Allowed to Answer
                          <FieldHint text="Cap how many questions from the pool each attempt may include (e.g. random subset)." />
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={settings.maxQuestionsToAnswer}
                          onChange={(e) => patchSettings('maxQuestionsToAnswer', e.target.value)}
                          className="mt-1.5 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Advanced Settings */}
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-3 text-left text-sm font-semibold text-brand-navy hover:bg-gray-50"
                  >
                    Advanced Settings
                    {advancedOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />}
                  </button>
                  {advancedOpen ? (
                    <div className="space-y-4 px-4 py-4">
                      <ToggleRow
                        id="quiz-auto-start"
                        label="Quiz Auto Start"
                        hint="Start the timer as soon as the quiz page opens."
                        checked={settings.quizAutoStart}
                        onChange={(v) => patchSettings('quizAutoStart', v)}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Question Layout</label>
                          <select
                            value={settings.questionLayout}
                            onChange={(e) => patchSettings('questionLayout', e.target.value as QuizQuestionLayout)}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="single_question">Single question</option>
                            <option value="multiple">Multiple questions per page</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Question Order</label>
                          <select
                            value={settings.questionOrder}
                            onChange={(e) => patchSettings('questionOrder', e.target.value as QuizQuestionOrder)}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="sort">Defined order</option>
                            <option value="random">Random</option>
                          </select>
                        </div>
                      </div>

                      <ToggleRow
                        id="hide-question-number"
                        label="Hide Question Number"
                        checked={settings.hideQuestionNumber}
                        onChange={(v) => patchSettings('hideQuestionNumber', v)}
                      />

                      <div>
                        <label className="text-sm font-medium text-gray-700">Set Character Limit for Short Answers</label>
                        <input
                          type="number"
                          min={0}
                          value={settings.shortAnswerCharLimit}
                          onChange={(e) => patchSettings('shortAnswerCharLimit', e.target.value)}
                          className="mt-1.5 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700">Set Character Limit for Open-Ended / Essay Answers</label>
                        <input
                          type="number"
                          min={0}
                          value={settings.essayCharLimit}
                          onChange={(e) => patchSettings('essayCharLimit', e.target.value)}
                          className="mt-1.5 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
                  >
                    Ok
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
