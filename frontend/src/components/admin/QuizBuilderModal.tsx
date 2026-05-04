import { useCallback, useEffect, useState } from 'react'
import { X, ClipboardList, Plus, Trash2, ChevronDown, ChevronRight, Info, Eye, GripVertical } from 'lucide-react'
import type {
  QuizQuestionDraft,
  QuizQuestionFillBlank,
  QuizQuestionMcq,
  QuizQuestionShortAnswer,
  QuizQuestionTrueFalse,
  QuizQuestionType,
} from '@/components/admin/quizQuestionTypes'
import {
  changeQuestionType,
  countFillBlanks,
  migrateQuizQuestion,
  newFillBlankQuestion,
  newMcqQuestion,
  newShortAnswerQuestion,
  newTrueFalseQuestion,
  questionSummaryLine,
} from '@/components/admin/quizQuestionTypes'

export type { QuizQuestionDraft, QuizQuestionType } from '@/components/admin/quizQuestionTypes'

export type QuizTimeUnit = 'Minutes' | 'Hours' | 'Seconds'
export type QuizFeedbackMode = 'retry' | 'reveal' | 'default'
export type QuizQuestionLayout = 'single_question' | 'multiple'
export type QuizQuestionOrder = 'sort' | 'random'
export type QuizResultReveal = 'immediate' | 'after_deadline' | 'hidden'

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
  resultReveal: QuizResultReveal
  quizDeadlineAt: string
  allowReattempt: boolean
  reattemptMax: string
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
    resultReveal: 'immediate',
    quizDeadlineAt: '',
    allowReattempt: true,
    reattemptMax: '3',
  }
}

function normalizeQuizSettings(input: Partial<QuizSettingsDraft> | undefined): QuizSettingsDraft {
  const d = defaultQuizSettings()
  if (!input) return d
  const rr = input.resultReveal
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
    resultReveal:
      rr === 'immediate' || rr === 'after_deadline' || rr === 'hidden' ? rr : d.resultReveal,
    quizDeadlineAt: input.quizDeadlineAt ?? d.quizDeadlineAt,
    allowReattempt: input.allowReattempt ?? d.allowReattempt,
    reattemptMax: input.reattemptMax ?? d.reattemptMax,
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
  initialQuestions: unknown[]
  initialSettings?: Partial<QuizSettingsDraft>
  onClose: () => void
  onSave: (draft: QuizTopicDraft & { published: boolean }) => void
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
    initialQuestions.length ? initialQuestions.map((q, i) => migrateQuizQuestion(q, i)) : [],
  )
  const [settings, setSettings] = useState<QuizSettingsDraft>(() => normalizeQuizSettings(initialSettings))
  const [basicOpen, setBasicOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const topicLine = topicLabel.trim() || 'Untitled topic'

  useEffect(() => {
    if (!open) return
    setTab('details')
    setTitle(initialTitle)
    setSummary(initialSummary)
    setQuestions(initialQuestions.length ? initialQuestions.map((q, i) => migrateQuizQuestion(q, i)) : [])
    setSettings(normalizeQuizSettings(initialSettings))
    setBasicOpen(true)
    setAdvancedOpen(true)
    setSelectedId(null)
    setDragIndex(null)
  }, [open, initialTitle, initialSummary, initialQuestions, initialSettings])

  const selected = questions.find((q) => q.id === selectedId) ?? null

  const addQuestion = useCallback(() => {
    const id = newQuestionId()
    setQuestions((prev) => [...prev, newMcqQuestion(id)])
    setSelectedId(id)
  }, [])

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
    setSelectedId((sid) => (sid === id ? null : sid))
  }

  const patchQuestion = (id: string, patch: Partial<QuizQuestionDraft> | QuizQuestionDraft) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? ({ ...q, ...patch } as QuizQuestionDraft) : q)))
  }

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= questions.length || to >= questions.length) return
    setQuestions((prev) => {
      const n = [...prev]
      const [row] = n.splice(from, 1)
      n.splice(to, 0, row)
      return n
    })
  }

  const totalMarks = questions.reduce((s, q) => s + (Number.isFinite(q.marks) ? q.marks : 0), 0)

  const handleSaveDraft = () => {
    onSave({ title: title.trim(), summary: summary.trim(), questions, settings, published: false })
  }

  const handlePublish = () => {
    onSave({ title: title.trim(), summary: summary.trim(), questions, settings, published: true })
  }

  const publishOk = title.trim() && questions.length > 0

  const patchSettings = <K extends keyof QuizSettingsDraft>(key: K, value: QuizSettingsDraft[K]) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  const renderQuestionForm = (compact: boolean) => {
    if (!selected) return <p className="text-sm text-gray-500">Select a question to edit.</p>
    const q = selected
    const rows = compact ? 3 : 4
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Question type</label>
          <select
            value={q.questionType}
            onChange={(e) => {
              const t = e.target.value as QuizQuestionType
              patchQuestion(q.id, changeQuestionType(q, t))
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
          >
            <option value="mcq">Multiple choice</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short answer</option>
            <option value="fill_blank">Fill in the blank</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Marks</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={q.marks}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              patchQuestion(q.id, { marks: Number.isFinite(v) && v >= 0 ? Math.min(v, 1000) : 0 } as Partial<QuizQuestionDraft>)
            }}
            className="mt-1 w-full max-w-[120px] rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Question text</label>
          <textarea
            value={q.title}
            onChange={(e) => {
              const t = e.target.value
              if (q.questionType === 'fill_blank') {
                setQuestions((prev) =>
                  prev.map((qq) => {
                    if (qq.id !== q.id || qq.questionType !== 'fill_blank') return qq
                    const n = Math.max(1, countFillBlanks(t) || qq.fillBlankAnswers.length || 1)
                    const cur = [...qq.fillBlankAnswers]
                    while (cur.length < n) cur.push('')
                    cur.length = n
                    return { ...qq, title: t, fillBlankAnswers: cur }
                  }),
                )
                return
              }
              patchQuestion(q.id, { title: t } as Partial<QuizQuestionDraft>)
            }}
            rows={rows}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            placeholder={
              q.questionType === 'fill_blank'
                ? 'Use ___ (three underscores) for each blank.'
                : 'Write the question…'
            }
          />
        </div>

        {q.questionType === 'mcq' ? (
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-gray-600">Options (4)</label>
            </div>
            <ul className="space-y-2">
              {q.options.map((opt, idx) => (
                <li key={idx} className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-medium text-gray-600">
                    <input
                      type="radio"
                      name={`mcq-${q.id}`}
                      checked={q.correctOptionIndex === idx}
                      onChange={() => patchQuestion(q.id, { correctOptionIndex: idx } as Partial<QuizQuestionMcq>)}
                      className="h-3.5 w-3.5 text-brand-accent"
                    />
                    OK
                  </label>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...q.options]
                      next[idx] = e.target.value
                      patchQuestion(q.id, { options: next } as Partial<QuizQuestionMcq>)
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {q.questionType === 'true_false' ? (
          <div>
            <p className="text-xs font-medium text-gray-600">Correct answer</p>
            <div className="mt-1 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`tf-${q.id}`}
                  checked={q.tfCorrect === true}
                  onChange={() => patchQuestion(q.id, { tfCorrect: true } as Partial<QuizQuestionTrueFalse>)}
                  className="text-brand-accent"
                />
                True
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`tf-${q.id}`}
                  checked={q.tfCorrect === false}
                  onChange={() => patchQuestion(q.id, { tfCorrect: false } as Partial<QuizQuestionTrueFalse>)}
                  className="text-brand-accent"
                />
                False
              </label>
            </div>
          </div>
        ) : null}

        {q.questionType === 'short_answer' ? (
          <div>
            <label className="text-xs font-medium text-gray-600">Model answer (admin only; not auto-graded)</label>
            <textarea
              value={q.modelAnswer}
              onChange={(e) => patchQuestion(q.id, { modelAnswer: e.target.value } as Partial<QuizQuestionShortAnswer>)}
              rows={compact ? 2 : 3}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        ) : null}

        {q.questionType === 'fill_blank' ? (
          <div>
            <p className="text-xs text-gray-500">
              Blanks detected: {countFillBlanks(q.title) || q.fillBlankAnswers.length}. One correct answer field per blank in order.
            </p>
            <ul className="mt-2 space-y-2">
              {q.fillBlankAnswers.map((ans, idx) => (
                <li key={idx}>
                  <label className="text-[11px] text-gray-600">Blank {idx + 1}</label>
                  <input
                    type="text"
                    value={ans}
                    onChange={(e) => {
                      const next = [...q.fillBlankAnswers]
                      next[idx] = e.target.value
                      patchQuestion(q.id, { fillBlankAnswers: next } as Partial<QuizQuestionFillBlank>)
                    }}
                    className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    )
  }

  if (!open) return null

  const hasTitle = title.trim().length > 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-label="Close quiz builder" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-builder-title"
        className="relative flex max-h-[min(92vh,900px)] w-full max-w-[min(96vw,1200px)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
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
                Questions
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
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800" aria-label="Close">
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
              Questions
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
              <aside className="flex w-full shrink-0 flex-col border-gray-200 bg-gray-50/80 p-4 sm:p-5 lg:w-[260px] lg:border-r">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quiz title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-brand-navy focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                  placeholder="Quiz title"
                  autoFocus
                />
                <label className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={5}
                  className="mt-1.5 min-h-[100px] w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                  placeholder="Short description…"
                />
                <p className="mt-3 text-xs text-gray-500">Total marks (sum): <span className="font-semibold text-brand-navy">{totalMarks}</span></p>
                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-4">
                  <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    disabled={!publishOk}
                    onClick={handlePublish}
                    className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                  >
                    Publish
                  </button>
                </div>
              </aside>

              <section className="flex min-h-[200px] min-w-0 flex-1 flex-col border-gray-200 bg-white p-4 sm:p-6 lg:border-r">
                {!hasTitle ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-10 text-center">
                    <ClipboardList className="h-14 w-14 text-gray-400" strokeWidth={1.25} />
                    <p className="mt-6 max-w-md text-sm text-gray-600">Enter a quiz title, then add questions. Drag questions by the handle to reorder.</p>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-brand-navy">Questions</h3>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={addQuestion}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-accent bg-white px-3 py-1.5 text-xs font-semibold text-brand-accent hover:bg-blue-50"
                        >
                          <Plus className="h-3.5 w-3.5" /> MCQ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const id = newQuestionId()
                            setQuestions((p) => [...p, newTrueFalseQuestion(id)])
                            setSelectedId(id)
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          + T/F
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const id = newQuestionId()
                            setQuestions((p) => [...p, newShortAnswerQuestion(id)])
                            setSelectedId(id)
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          + Short
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const id = newQuestionId()
                            setQuestions((p) => [...p, newFillBlankQuestion(id)])
                            setSelectedId(id)
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          + Blank
                        </button>
                      </div>
                    </div>
                    <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {questions.length === 0 ? (
                        <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500">
                          No questions yet.
                        </li>
                      ) : (
                        questions.map((q, index) => (
                          <li
                            key={q.id}
                            draggable
                            onDragStart={() => setDragIndex(index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragIndex === null) return
                              reorder(dragIndex, index)
                              setDragIndex(null)
                            }}
                            onDragEnd={() => setDragIndex(null)}
                            className={`flex items-stretch gap-1 rounded-lg border ${
                              selectedId === q.id ? 'border-brand-accent bg-blue-50 ring-1 ring-brand-accent/20' : 'border-gray-200 bg-white'
                            }`}
                          >
                            <button
                              type="button"
                              className="shrink-0 cursor-grab px-1.5 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
                              aria-label="Drag to reorder"
                              title="Drag to reorder"
                            >
                              <GripVertical className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedId(q.id)}
                              className="min-w-0 flex-1 px-2 py-2 text-left text-sm"
                            >
                              <span className="block truncate font-medium text-brand-navy">{q.title.trim() || 'Untitled'}</span>
                              <span className="mt-0.5 block text-[11px] text-gray-500">
                                {q.questionType.toUpperCase()} · {questionSummaryLine(q)}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeQuestion(q.id)}
                              className="shrink-0 self-center rounded p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                              aria-label="Remove question"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                    {selected ? <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50/90 p-3 lg:hidden">{renderQuestionForm(true)}</div> : null}
                  </div>
                )}
              </section>

              <aside className="hidden w-[min(100%,340px)] shrink-0 flex-col overflow-y-auto border-l border-gray-100 bg-gray-50/50 p-4 lg:flex">
                {selected ? renderQuestionForm(false) : <p className="text-sm text-gray-500">Select a question.</p>}
              </aside>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
              <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 sm:px-6">
                <p className="text-xs text-gray-500">Stored on this quiz topic. Student runtime can enforce these later.</p>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setBasicOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-3 text-left text-sm font-semibold text-brand-navy hover:bg-gray-50"
                  >
                    Basic settings
                    {basicOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />}
                  </button>
                  {basicOpen ? (
                    <div className="space-y-4 px-4 py-4">
                      <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                          Time limit
                          <FieldHint text="0 = no limit." />
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
                      <ToggleRow id="hide-quiz-time" label="Hide quiz timer" checked={settings.hideQuizTime} onChange={(v) => patchSettings('hideQuizTime', v)} />
                      <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">Feedback mode</label>
                        <div className="relative mt-1.5">
                          <Eye className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <select
                            value={settings.feedbackMode}
                            onChange={(e) => patchSettings('feedbackMode', e.target.value as QuizFeedbackMode)}
                            className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm"
                          >
                            <option value="retry">Retry</option>
                            <option value="reveal">Reveal answers</option>
                            <option value="default">Default</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Result reveal</label>
                        <select
                          value={settings.resultReveal}
                          onChange={(e) => patchSettings('resultReveal', e.target.value as QuizResultReveal)}
                          className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="immediate">Immediately after submit</option>
                          <option value="after_deadline">After deadline</option>
                          <option value="hidden">Hidden (manual grading)</option>
                        </select>
                      </div>
                      {settings.resultReveal === 'after_deadline' ? (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Quiz deadline</label>
                          <input
                            type="datetime-local"
                            value={settings.quizDeadlineAt}
                            onChange={(e) => patchSettings('quizDeadlineAt', e.target.value)}
                            className="mt-1.5 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      ) : null}
                      <div>
                        <label className="text-sm font-medium text-gray-700">Attempts allowed</label>
                        <input
                          type="number"
                          min={1}
                          value={settings.attemptsAllowed}
                          onChange={(e) => patchSettings('attemptsAllowed', e.target.value)}
                          className="mt-1.5 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <ToggleRow
                        id="allow-reattempt"
                        label="Allow re-attempts (cap)"
                        checked={settings.allowReattempt}
                        onChange={(v) => patchSettings('allowReattempt', v)}
                      />
                      {settings.allowReattempt ? (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Max re-attempts</label>
                          <input
                            type="number"
                            min={1}
                            value={settings.reattemptMax}
                            onChange={(e) => patchSettings('reattemptMax', e.target.value)}
                            className="mt-1.5 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      ) : null}
                      <div>
                        <label className="text-sm font-medium text-gray-700">Passing grade (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={settings.passingGradePercent}
                          onChange={(e) => patchSettings('passingGradePercent', e.target.value)}
                          className="mt-1.5 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Max questions per attempt</label>
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

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-3 text-left text-sm font-semibold text-brand-navy hover:bg-gray-50"
                  >
                    Advanced
                    {advancedOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />}
                  </button>
                  {advancedOpen ? (
                    <div className="space-y-4 px-4 py-4">
                      <ToggleRow id="quiz-auto-start" label="Quiz auto-start" checked={settings.quizAutoStart} onChange={(v) => patchSettings('quizAutoStart', v)} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Question layout</label>
                          <select
                            value={settings.questionLayout}
                            onChange={(e) => patchSettings('questionLayout', e.target.value as QuizQuestionLayout)}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="single_question">One at a time</option>
                            <option value="multiple">Multiple per page</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Question order</label>
                          <select
                            value={settings.questionOrder}
                            onChange={(e) => patchSettings('questionOrder', e.target.value as QuizQuestionOrder)}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="sort">Fixed (editor order)</option>
                            <option value="random">Random</option>
                          </select>
                        </div>
                      </div>
                      <ToggleRow id="hide-qnum" label="Hide question number" checked={settings.hideQuestionNumber} onChange={(v) => patchSettings('hideQuestionNumber', v)} />
                      <div>
                        <label className="text-sm font-medium text-gray-700">Short answer char limit</label>
                        <input
                          type="number"
                          min={0}
                          value={settings.shortAnswerCharLimit}
                          onChange={(e) => patchSettings('shortAnswerCharLimit', e.target.value)}
                          className="mt-1.5 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Essay char limit</label>
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

                <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
                  <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    disabled={!publishOk}
                    onClick={handlePublish}
                    className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                  >
                    Publish
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
