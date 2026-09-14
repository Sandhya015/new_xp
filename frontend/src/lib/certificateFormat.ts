import type { CertificateVerifySuccess } from '@/services/certificateService'

export const CERTIFICATE_VERIFY_URL = 'https://www.xpertintern.com/verify'

export const CERTIFICATE_COMPANY = 'Xpert Ventures Private Limited'

export const CERTIFICATE_SIGNATORY = 'Om Raj'

export const CERTIFICATE_SIGNATORY_TITLE = 'Founder & CEO'

/** Complete signatory block image (signature, stamp, name, title, company). */
export const CERTIFICATE_SIGNATORY_BLOCK_SRC = '/certificate/signatory-block.png'

/** @deprecated Use CERTIFICATE_SIGNATORY_BLOCK_SRC via SignatoryBlock */
export const CERTIFICATE_SIGNATURE_SRC = CERTIFICATE_SIGNATORY_BLOCK_SRC

export const CERTIFICATE_HEADER_BAND_SRC = '/certificate/header-band.png'

export const CERTIFICATE_FOOTER_BAND_SRC = '/certificate/footer-band.png'

export const CERTIFICATE_DEFAULT_MODE = 'Online'

export const CERTIFICATE_ASSESSMENT_CRITERIA = [
  'Technical Knowledge & Application',
  'Quality of Work & Task Completion',
  'Initiative & Problem-Solving Ability',
  'Communication & Interpersonal Skills',
  'Punctuality, Discipline & Professional Conduct',
] as const

export const CERTIFICATE_ASSESSMENT_RATINGS = ['Good', 'Outstanding'] as const

export type CertificateAssessmentRating = (typeof CERTIFICATE_ASSESSMENT_RATINGS)[number]

export type CertificateAssessmentRow = {
  criteria: string
  rating: CertificateAssessmentRating
}

export type CertificateDisplayData = {
  studentName?: string | null
  universityRollNo?: string | null
  registrationNo?: string | null
  collegeName?: string | null
  universityName?: string | null
  academicSession?: string | null
  degree?: string | null
  subject?: string | null
  internshipDomain?: string | null
  internshipDuration?: string | null
  internshipPeriod?: string | null
  internshipMode?: string | null
  totalHours?: string | null
  creditsRecommended?: string | null
  creditsLabel?: string | null
  attendancePercent?: string | null
  marksPercent?: string | null
  assessmentRows?: CertificateAssessmentRow[] | null
  certificateId?: string | null
  issueDate?: string | null
  verifyUrl?: string | null
}

function stableHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash
}

export function certificateVerifyUrl(certificateId: string): string {
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/verify`
      : CERTIFICATE_VERIFY_URL
  return `${base}/${encodeURIComponent(certificateId.trim())}`
}

function pickCertificateMarksPercent(seed: string): number {
  const options = [90, 95, 100] as const
  return options[stableHash(`${seed}:marks`) % options.length]
}

function pickCertificateAssessmentRating(seed: string, index: number): CertificateAssessmentRating {
  const options = CERTIFICATE_ASSESSMENT_RATINGS
  return options[stableHash(`${seed}:assessment:${index}`) % options.length]
}

export function randomizedCertificateAssessmentRows(seed: string): CertificateAssessmentRow[] {
  return CERTIFICATE_ASSESSMENT_CRITERIA.map((criteria, index) => ({
    criteria,
    rating: pickCertificateAssessmentRating(seed, index),
  }))
}

function parseIsoDate(raw?: string | null): Date | null {
  const s = String(raw || '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T12:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatCertificateIssueDate(raw?: string | null): string {
  const d = parseIsoDate(raw)
  if (!d) return new Date().toLocaleDateString('en-GB')
  return d.toLocaleDateString('en-GB')
}

export function formatCertificateCalendarDate(raw?: string | null): string {
  const d = parseIsoDate(raw)
  if (!d) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatCertificatePeriodLabel(start?: string | null, end?: string | null): string {
  const from = formatCertificateCalendarDate(start)
  const to = formatCertificateCalendarDate(end)
  if (from && to) return `${from} - ${to}`
  return from || to || ''
}

function formatPercent(value?: string | null, fallback?: string): string {
  const s = String(value ?? '').trim()
  if (s) return s.includes('%') ? s : `${s}%`
  return fallback || '—'
}

function computeDurationWeeks(start?: string | null, end?: string | null, duration?: string | null): string {
  const d = String(duration || '').trim()
  if (d) return d
  const startD = parseIsoDate(start)
  const endD = parseIsoDate(end)
  if (!startD || !endD || endD < startD) return '4 Weeks'
  const days = Math.floor((endD.getTime() - startD.getTime()) / (24 * 60 * 60 * 1000)) + 1
  const weeks = Math.max(1, Math.round(days / 7))
  return weeks === 1 ? '1 Week' : `${weeks} Weeks`
}

function courseMajorLabel(course?: string | null, branch?: string | null): string {
  const c = String(course || '').trim()
  const b = String(branch || '').trim()
  if (c && b) return `${c} (${b})`
  return c || b || ''
}

/** Map public verify API payload → certificate layout data. */
export function certificateDisplayFromVerify(v: CertificateVerifySuccess): CertificateDisplayData {
  const seed =
    v.certificate_no ||
    v.registration_no ||
    v.studentName ||
    v.name ||
    'certificate'

  const marks =
    formatPercent(v.marks, `${pickCertificateMarksPercent(seed)}%`) !== '—'
      ? formatPercent(v.marks, `${pickCertificateMarksPercent(seed)}%`)
      : `${pickCertificateMarksPercent(seed)}%`

  const attendance = formatPercent(v.attendance, `${pickCertificateMarksPercent(`${seed}:att`)}%`)

  let assessmentRows =
    v.assessmentRows?.length === CERTIFICATE_ASSESSMENT_CRITERIA.length
      ? v.assessmentRows
      : randomizedCertificateAssessmentRows(seed)
  if (v.performanceRating?.trim()) {
    const rating = v.performanceRating.trim() === 'Outstanding' ? 'Outstanding' : 'Good'
    assessmentRows = CERTIFICATE_ASSESSMENT_CRITERIA.map((criteria) => ({ criteria, rating }))
  }

  const start = v.internship_start_date || v.start_date
  const end = v.internship_end_date || v.end_date || v.completionDate

  return {
    studentName: v.studentName || v.name,
    universityRollNo: v.registration_no,
    registrationNo: v.registration_no,
    collegeName: v.college_name || v.university,
    universityName: v.university || v.college_name,
    academicSession: v.session || undefined,
    degree: v.course || v.programName,
    subject: v.branch,
    internshipDomain: v.domain || v.programName || v.course,
    internshipDuration: computeDurationWeeks(start, end, v.duration),
    internshipPeriod: formatCertificatePeriodLabel(start, end) || '—',
    internshipMode: v.mode || CERTIFICATE_DEFAULT_MODE,
    attendancePercent: attendance,
    marksPercent: marks,
    assessmentRows,
    certificateId: v.certificate_no || v.certificateId,
    issueDate: formatCertificateIssueDate(v.issueDate || end),
    verifyUrl: v.verify_url || certificateVerifyUrl(v.certificate_no || v.certificateId),
  }
}

/** Build display data from admin document student profile (preview / batch). */
export function certificateDisplayFromProfile(
  profile: Record<string, string | undefined | null>,
  options?: {
    certNo?: string
    courseTitle?: string
    issueDate?: string
    marks?: string
    attendance?: string
    startDate?: string
    endDate?: string
    duration?: string
    mode?: string
    performanceRating?: string
    showSignature?: boolean
  }
): CertificateDisplayData {
  const certNo = options?.certNo || profile.certificateId || profile.registrationNo || 'PREVIEW'
  const seed = certNo || profile.name || 'preview'
  const start = options?.startDate || profile.internshipStartDate
  const end = options?.endDate || profile.internshipEndDate

  const rows =
    options?.performanceRating && options.performanceRating.trim()
      ? CERTIFICATE_ASSESSMENT_CRITERIA.map((criteria) => ({
          criteria,
          rating: (options.performanceRating === 'Outstanding' ? 'Outstanding' : 'Good') as CertificateAssessmentRating,
        }))
      : randomizedCertificateAssessmentRows(seed)

  return {
    studentName: profile.name || profile.fullName || 'Student',
    universityRollNo: profile.registrationNo || profile.collegeRegNo,
    registrationNo: profile.registrationNo || profile.collegeRegNo,
    collegeName: profile.collegeName || profile.university,
    universityName: profile.university || profile.collegeName,
    academicSession: profile.session,
    degree: profile.course,
    subject: profile.branch || profile.branchOrSubject || profile.stream,
    internshipDomain: profile.domain || options?.courseTitle || profile.course,
    internshipDuration: computeDurationWeeks(start, end, options?.duration || profile.duration),
    internshipPeriod: formatCertificatePeriodLabel(start, end) || '—',
    internshipMode: options?.mode || profile.mode || CERTIFICATE_DEFAULT_MODE,
    attendancePercent: formatPercent(options?.attendance || profile.attendance, '90%'),
    marksPercent: formatPercent(options?.marks || profile.marks, `${pickCertificateMarksPercent(seed)}%`),
    assessmentRows: rows,
    certificateId: certNo,
    issueDate: formatCertificateIssueDate(options?.issueDate || end),
    verifyUrl: certificateVerifyUrl(certNo),
  }
}

export { courseMajorLabel }
