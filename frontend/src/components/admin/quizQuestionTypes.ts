/**
 * Quiz question shapes stored in curriculum JSON (normalized on the server).
 * Legacy rows without `questionType` are treated as MCQ.
 */

export type QuizQuestionType = 'mcq' | 'true_false' | 'short_answer' | 'fill_blank'

export type QuizQuestionMcq = {
  id: string
  questionType: 'mcq'
  title: string
  marks: number
  options: string[]
  correctOptionIndex: number
}

export type QuizQuestionTrueFalse = {
  id: string
  questionType: 'true_false'
  title: string
  marks: number
  tfCorrect: boolean
}

export type QuizQuestionShortAnswer = {
  id: string
  questionType: 'short_answer'
  title: string
  marks: number
  modelAnswer: string
}

export type QuizQuestionFillBlank = {
  id: string
  questionType: 'fill_blank'
  title: string
  marks: number
  fillBlankAnswers: string[]
}

export type QuizQuestionDraft =
  | QuizQuestionMcq
  | QuizQuestionTrueFalse
  | QuizQuestionShortAnswer
  | QuizQuestionFillBlank

export function countFillBlanks(title: string): number {
  return (title.match(/___/g) || []).length
}

function stableId(raw: unknown, idx: number): string {
  if (raw && typeof raw === 'object' && 'id' in raw && typeof (raw as { id: unknown }).id === 'string') {
    const id = (raw as { id: string }).id.trim()
    if (id) return id
  }
  return `q_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 9)}`
}

function parseMarks(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.min(raw, 1000)
  if (typeof raw === 'string' && raw.trim()) {
    const n = parseFloat(raw)
    if (Number.isFinite(n) && n >= 0) return Math.min(n, 1000)
  }
  return 1
}

/** Upgrade legacy MCQ-only payloads to typed drafts. */
export function migrateQuizQuestion(raw: unknown, idx: number): QuizQuestionDraft {
  const id = stableId(raw, idx)
  if (!raw || typeof raw !== 'object') {
    return { id, questionType: 'mcq', title: '', marks: 1, options: ['', '', '', ''], correctOptionIndex: 0 }
  }
  const r = raw as Record<string, unknown>
  const title = typeof r.title === 'string' ? r.title : ''
  const marks = parseMarks(r.marks)
  const qt = typeof r.questionType === 'string' ? r.questionType.toLowerCase() : ''

  if (qt === 'true_false') {
    return {
      id,
      questionType: 'true_false',
      title,
      marks,
      tfCorrect: r.tfCorrect === false ? false : true,
    }
  }
  if (qt === 'short_answer') {
    return {
      id,
      questionType: 'short_answer',
      title,
      marks,
      modelAnswer: typeof r.modelAnswer === 'string' ? r.modelAnswer : '',
    }
  }
  if (qt === 'fill_blank') {
    const arr = Array.isArray(r.fillBlankAnswers) ? r.fillBlankAnswers.map((x) => String(x ?? '')) : []
    return { id, questionType: 'fill_blank', title, marks, fillBlankAnswers: arr }
  }

  const opts = Array.isArray(r.options) ? r.options.map((x) => String(x ?? '')) : ['', '']
  while (opts.length < 2) opts.push('')
  while (opts.length < 4) opts.push('')
  let ci = 0
  if (typeof r.correctOptionIndex === 'number') ci = Math.floor(r.correctOptionIndex)
  else if (typeof r.correctOptionIndex === 'string' && r.correctOptionIndex.trim()) {
    const p = parseInt(r.correctOptionIndex, 10)
    if (!Number.isNaN(p)) ci = p
  }
  ci = Math.max(0, Math.min(ci, opts.length - 1))
  return { id, questionType: 'mcq', title, marks, options: opts, correctOptionIndex: ci }
}

export function newMcqQuestion(id: string): QuizQuestionDraft {
  return { id, questionType: 'mcq', title: '', marks: 1, options: ['', '', '', ''], correctOptionIndex: 0 }
}

export function newTrueFalseQuestion(id: string): QuizQuestionDraft {
  return { id, questionType: 'true_false', title: '', marks: 1, tfCorrect: true }
}

export function newShortAnswerQuestion(id: string): QuizQuestionDraft {
  return { id, questionType: 'short_answer', title: '', marks: 1, modelAnswer: '' }
}

export function newFillBlankQuestion(id: string): QuizQuestionDraft {
  return { id, questionType: 'fill_blank', title: 'Fill in the blank: The capital of ___ is busy.', marks: 1, fillBlankAnswers: [''] }
}

export function questionSummaryLine(q: QuizQuestionDraft): string {
  switch (q.questionType) {
    case 'mcq':
      return `${q.options.filter((o) => o.trim()).length || q.options.length} options · correct #${q.correctOptionIndex + 1} · ${q.marks} pt`
    case 'true_false':
      return `True/False · answer: ${q.tfCorrect ? 'True' : 'False'} · ${q.marks} pt`
    case 'short_answer':
      return `Short answer · ${q.marks} pt`
    case 'fill_blank':
      return `${countFillBlanks(q.title) || q.fillBlankAnswers.length} blank(s) · ${q.marks} pt`
    default:
      return ''
  }
}

export function changeQuestionType(q: QuizQuestionDraft, t: QuizQuestionType): QuizQuestionDraft {
  const id = q.id
  const title = q.title
  const marks = q.marks
  if (t === 'mcq') {
    return { id, questionType: 'mcq', title, marks, options: ['', '', '', ''], correctOptionIndex: 0 }
  }
  if (t === 'true_false') {
    return { id, questionType: 'true_false', title, marks, tfCorrect: true }
  }
  if (t === 'short_answer') {
    return { id, questionType: 'short_answer', title, marks, modelAnswer: '' }
  }
  return { id, questionType: 'fill_blank', title: title || 'Use ___ for each blank.', marks, fillBlankAnswers: [''] }
}
