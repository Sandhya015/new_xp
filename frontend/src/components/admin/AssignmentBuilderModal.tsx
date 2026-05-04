import { useEffect, useState } from 'react'
import { X, ClipboardCheck, Plus, Trash2 } from 'lucide-react'

export type AssignmentQuestionRow = { prompt: string }
export type AssignmentAttachmentRow = { name: string; url: string }

export type AssignmentTopicDraft = {
  title: string
  instructions: string
  maxMarks: string
  deadline: string
  allowText: boolean
  allowPdf: boolean
  allowDoc: boolean
  allowZip: boolean
  maxFileSizeMb: string
  modelAnswer: string
  allowResubmission: boolean
  resubmissionDeadline: string
  questions: AssignmentQuestionRow[]
  attachments: AssignmentAttachmentRow[]
}

export function defaultAssignmentDraft(): AssignmentTopicDraft {
  return {
    title: '',
    instructions: '',
    maxMarks: '10',
    deadline: '',
    allowText: true,
    allowPdf: true,
    allowDoc: false,
    allowZip: false,
    maxFileSizeMb: '25',
    modelAnswer: '',
    allowResubmission: false,
    resubmissionDeadline: '',
    questions: [],
    attachments: [],
  }
}

function normalizeDraft(input: Partial<AssignmentTopicDraft> | undefined): AssignmentTopicDraft {
  const d = defaultAssignmentDraft()
  if (!input) return d
  const qs = Array.isArray(input.questions)
    ? input.questions
        .filter((x) => x && typeof x === 'object')
        .map((x) => ({ prompt: typeof x.prompt === 'string' ? x.prompt : '' }))
    : []
  const ats = Array.isArray(input.attachments)
    ? input.attachments
        .filter((x) => x && typeof x === 'object')
        .map((x) => ({
          name: typeof x.name === 'string' ? x.name : '',
          url: typeof x.url === 'string' ? x.url : '',
        }))
    : []
  return {
    title: typeof input.title === 'string' ? input.title : d.title,
    instructions: typeof input.instructions === 'string' ? input.instructions : d.instructions,
    maxMarks: input.maxMarks != null && String(input.maxMarks).trim() ? String(input.maxMarks) : d.maxMarks,
    deadline: typeof input.deadline === 'string' ? input.deadline : d.deadline,
    allowText: input.allowText !== false,
    allowPdf: Boolean(input.allowPdf),
    allowDoc: Boolean(input.allowDoc),
    allowZip: Boolean(input.allowZip),
    maxFileSizeMb:
      input.maxFileSizeMb != null && String(input.maxFileSizeMb).trim() ? String(input.maxFileSizeMb) : d.maxFileSizeMb,
    modelAnswer: typeof input.modelAnswer === 'string' ? input.modelAnswer : d.modelAnswer,
    allowResubmission: Boolean(input.allowResubmission),
    resubmissionDeadline:
      typeof input.resubmissionDeadline === 'string' ? input.resubmissionDeadline : d.resubmissionDeadline,
    questions: qs,
    attachments: ats,
  }
}

export type AssignmentBuilderSave = {
  title: string
  summary: string
  assignment: AssignmentTopicDraft
  published: boolean
}

type AssignmentBuilderModalProps = {
  open: boolean
  moduleTitle: string
  topicLabel: string
  initialTitle: string
  initialSummary: string
  initialAssignment?: Partial<AssignmentTopicDraft>
  onClose: () => void
  onSave: (draft: AssignmentBuilderSave) => void
}

export function AssignmentBuilderModal({
  open,
  moduleTitle,
  topicLabel,
  initialTitle,
  initialSummary,
  initialAssignment,
  onClose,
  onSave,
}: AssignmentBuilderModalProps) {
  const [title, setTitle] = useState(initialTitle)
  const [summary, setSummary] = useState(initialSummary)
  const [a, setA] = useState<AssignmentTopicDraft>(() => normalizeDraft(initialAssignment))

  useEffect(() => {
    if (!open) return
    setTitle(initialTitle)
    setSummary(initialSummary)
    setA(normalizeDraft(initialAssignment))
  }, [open, initialTitle, initialSummary, initialAssignment])

  const topicLine = topicLabel.trim() || 'Untitled topic'

  const submissionOk = a.allowText || a.allowPdf || a.allowDoc || a.allowZip

  const strictOk =
    title.trim() &&
    a.title.trim() &&
    a.instructions.trim() &&
    a.maxMarks.trim() &&
    a.deadline.trim() &&
    submissionOk

  const saveDraft = () => {
    onSave({ title: title.trim(), summary: summary.trim(), assignment: a, published: false })
  }

  const publish = () => {
    onSave({ title: title.trim(), summary: summary.trim(), assignment: a, published: true })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-builder-title"
        className="relative flex max-h-[min(92vh,900px)] w-full max-w-[min(96vw,720px)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-brand-accent" aria-hidden />
            <div className="min-w-0">
              <h2 id="assignment-builder-title" className="text-base font-semibold text-brand-navy sm:text-lg">
                Assignment
              </h2>
              <p className="truncate text-xs text-gray-500 sm:text-sm">
                Topic: <span className="font-medium text-gray-700">{topicLine}</span>
                <span className="text-gray-400"> · </span>
                <span className="text-gray-500">{moduleTitle || 'Module'}</span>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Topic title (curriculum list)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-brand-navy"
              placeholder="Shown in the module outline"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Short line in the curriculum list"
            />
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-brand-navy">Question prompts (optional)</h3>
              <button
                type="button"
                onClick={() => setA((x) => ({ ...x, questions: [...x.questions, { prompt: '' }] }))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {a.questions.length === 0 ? (
              <p className="text-xs text-gray-500">No extra prompts. Instructions below are shown to students.</p>
            ) : (
              <ul className="space-y-2">
                {a.questions.map((row, i) => (
                  <li key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={row.prompt}
                      onChange={(e) =>
                        setA((x) => ({
                          ...x,
                          questions: x.questions.map((q, j) => (j === i ? { ...q, prompt: e.target.value } : q)),
                        }))
                      }
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      placeholder={`Question ${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => setA((x) => ({ ...x, questions: x.questions.filter((_, j) => j !== i) }))}
                      className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-white"
                      aria-label="Remove question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-brand-navy">Reference attachments (name + URL)</h3>
              <button
                type="button"
                onClick={() => setA((x) => ({ ...x, attachments: [...x.attachments, { name: '', url: '' }] }))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {a.attachments.length === 0 ? (
              <p className="text-xs text-gray-500">Optional links (readings, data files) listed for students.</p>
            ) : (
              <ul className="space-y-2">
                {a.attachments.map((row, i) => (
                  <li key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) =>
                        setA((x) => ({
                          ...x,
                          attachments: x.attachments.map((t, j) => (j === i ? { ...t, name: e.target.value } : t)),
                        }))
                      }
                      className="sm:w-1/3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      placeholder="Label"
                    />
                    <input
                      type="url"
                      value={row.url}
                      onChange={(e) =>
                        setA((x) => ({
                          ...x,
                          attachments: x.attachments.map((t, j) => (j === i ? { ...t, url: e.target.value } : t)),
                        }))
                      }
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      placeholder="https://…"
                    />
                    <button
                      type="button"
                      onClick={() => setA((x) => ({ ...x, attachments: x.attachments.filter((_, j) => j !== i) }))}
                      className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-white sm:self-center"
                      aria-label="Remove attachment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-brand-navy">Assignment details (students)</h3>
            <div>
              <label className="text-xs font-medium text-gray-700">Assignment title *</label>
              <input
                type="text"
                value={a.title}
                onChange={(e) => setA((x) => ({ ...x, title: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                placeholder="Title on the assignment page"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Instructions *</label>
              <textarea
                value={a.instructions}
                onChange={(e) => setA((x) => ({ ...x, instructions: e.target.value }))}
                rows={5}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                placeholder="What students must do (supports line breaks; rich editor can be added later)."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-700">Max marks *</label>
                <input
                  type="number"
                  min={1}
                  value={a.maxMarks}
                  onChange={(e) => setA((x) => ({ ...x, maxMarks: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Deadline *</label>
                <input
                  type="datetime-local"
                  value={a.deadline}
                  onChange={(e) => setA((x) => ({ ...x, deadline: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-700">Submission type * (at least one)</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {(
                  [
                    ['allowText', 'Text'],
                    ['allowPdf', 'PDF'],
                    ['allowDoc', 'DOC / DOCX'],
                    ['allowZip', 'ZIP'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(a[key])}
                      onChange={(e) => setA((x) => ({ ...x, [key]: e.target.checked }))}
                      className="rounded text-brand-accent"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {!submissionOk ? <p className="mt-1 text-xs text-red-600">Select at least one submission type.</p> : null}
            </div>

            <div className="w-full max-w-xs">
              <label className="text-xs font-medium text-gray-700">Max upload size (MB) *</label>
              <input
                type="number"
                min={1}
                max={500}
                value={a.maxFileSizeMb}
                onChange={(e) => setA((x) => ({ ...x, maxFileSizeMb: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Model answer (optional)</label>
              <textarea
                value={a.modelAnswer}
                onChange={(e) => setA((x) => ({ ...x, modelAnswer: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                placeholder="For admin reference or release after deadline (student UX wired later)."
              />
            </div>

            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={a.allowResubmission}
                  onChange={(e) => setA((x) => ({ ...x, allowResubmission: e.target.checked }))}
                  className="rounded text-brand-accent"
                />
                Allow re-submission
              </label>
              {a.allowResubmission ? (
                <div>
                  <label className="text-xs text-gray-600">Re-submission deadline</label>
                  <input
                    type="datetime-local"
                    value={a.resubmissionDeadline}
                    onChange={(e) => setA((x) => ({ ...x, resubmissionDeadline: e.target.value }))}
                    className="mt-1 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50/90 px-4 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!title.trim() || !submissionOk}
            onClick={saveDraft}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={!strictOk}
            onClick={publish}
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            Publish
          </button>
        </footer>
      </div>
    </div>
  )
}
