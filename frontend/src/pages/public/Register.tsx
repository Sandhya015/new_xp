import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Building2, Info, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'
import type { User as AuthUser } from '@/store/authStore'

import { REGISTRATION_UNIVERSITIES_LIST } from '@/constants/registrationUniversities'
import {
  OTHER_OPTION_VALUE,
  STUDENT_COURSES,
  BRANCHES_66,
  BRANCH_OTHERS_LABEL,
  subjectOptionsForCourse,
} from '@/constants/registrationLists'
import { DPIIT_INDUSTRY_SECTORS } from '@/constants/dpiitIndustrySectors'

const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
const DPIIT_SET = new Set(DPIIT_INDUSTRY_SECTORS)

type Tab = 'student' | 'company'

function maskEmail(email: string): string {
  const [u, d] = email.split('@')
  if (!d) return email
  const left = u.length <= 2 ? `${u[0] || ''}*` : `${u.slice(0, 2)}****`
  return `${left}@${d}`
}

function isFullNameOk(s: string): boolean {
  if (s.length < 3) return false
  for (const ch of s) {
    if (/\s/.test(ch) || ".'-".includes(ch)) continue
    if (!/\p{L}/u.test(ch)) return false
  }
  return true
}

function normalizeMobileInput(raw: string): { digits: string | null; error?: string } {
  let s = raw.trim().replace(/\s/g, '').replace(/-/g, '')
  if (s.startsWith('+91')) s = s.slice(3)
  else if (s.startsWith('91') && s.length === 12) s = s.slice(2)
  if (!/^\d{10}$/.test(s)) return { digits: null, error: 'Please enter a valid 10-digit mobile number.' }
  return { digits: s }
}

type StudentFormState = {
  fullName: string
  email: string
  mobile: string
  university: string
  universityOther: string
  collegeName: string
  semester: string
  collegeRegNo: string
  course: string
  branch: string
  branchOther: string
  subject: string
  subjectOther: string
  courseOther: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
}

function validateStudentForm(f: StudentFormState): Record<string, string> {
  const e: Record<string, string> = {}
  if (!isFullNameOk(f.fullName.trim())) {
    e.fullName = 'Please enter your full name (minimum 3 characters).'
  }
  const em = f.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    e.email = 'Please enter a valid email address.'
  }
  const mob = normalizeMobileInput(f.mobile)
  if (mob.error) e.mobile = mob.error
  if (!f.university) e.university = 'Please select your university.'
  if (f.university === OTHER_OPTION_VALUE && f.universityOther.trim().length < 5) {
    e.universityOther = 'Please enter your university name.'
  }
  if (!f.collegeName.trim()) e.collegeName = 'College name is required.'
  if (!f.semester) e.semester = 'Semester is required.'
  if (!f.collegeRegNo.trim()) e.collegeRegNo = 'College registration number is required.'
  if (!f.course) e.course = 'Please select your course.'

  if (f.course === OTHER_OPTION_VALUE) {
    if (f.courseOther.trim().length < 5) e.courseOther = 'Please specify your course name.'
  } else if (f.course === 'B.Tech' || f.course === 'Diploma') {
    if (!f.branch) e.branch = 'Please select your branch.'
    else if (!(BRANCHES_66 as readonly string[]).includes(f.branch)) {
      e.branch = 'Please select your branch.'
    } else if (f.branch === BRANCH_OTHERS_LABEL && f.branchOther.trim().length < 3) {
      e.branchOther = 'Please specify your branch name.'
    }
  } else if (['B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA'].includes(f.course)) {
    if (!f.subject) e.subject = 'Please select your subject or specialisation.'
    else if (f.subject === OTHER_OPTION_VALUE && f.subjectOther.trim().length < 3) {
      e.subjectOther = 'Please specify your subject name.'
    } else if (f.subject !== OTHER_OPTION_VALUE) {
      const allowed = subjectOptionsForCourse(f.course).filter((o) => o.value !== OTHER_OPTION_VALUE).map((o) => o.value)
      if (!allowed.includes(f.subject)) e.subject = 'Please select your subject or specialisation.'
    }
  }

  if (f.password.length < 8) e.password = 'Password must be at least 8 characters.'
  if (f.password !== f.confirmPassword) e.confirmPassword = 'Passwords do not match.'
  if (!f.acceptTerms) e.acceptTerms = 'You must accept the Terms & Conditions.'
  return e
}

type CompanyFormState = {
  companyName: string
  companyEmail: string
  mobile: string
  industryType: string
  address: string
  website: string
  hrName: string
  hrMobile: string
  password: string
  confirmPassword: string
}

function validateCompanyForm(f: CompanyFormState): Record<string, string> {
  const e: Record<string, string> = {}
  const name = f.companyName.trim()
  if (name.length < 3 || name.length > 150) {
    e.companyName = 'Please enter your company name.'
  }
  const em = f.companyEmail.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    e.companyEmail = 'Please enter a valid company email address.'
  }
  const mob = normalizeMobileInput(f.mobile)
  if (mob.error) e.mobile = mob.error
  if (!f.industryType || !DPIIT_SET.has(f.industryType)) {
    e.industryType = 'Please select your industry type.'
  }
  if (!f.address.trim()) e.address = 'Company address is required.'
  if (f.website.trim()) {
    const raw = f.website.trim()
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    try {
      const u = new URL(withProto)
      if (!u.hostname) e.website = 'Please enter a valid website URL.'
    } catch {
      e.website = 'Please enter a valid website URL.'
    }
  }
  if (!f.hrName.trim()) e.hrName = 'HR contact name is required.'
  const hrMob = normalizeMobileInput(f.hrMobile)
  if (hrMob.error) e.hrMobile = hrMob.error
  if (f.password.length < 8) e.password = 'Password must be at least 8 characters.'
  if (f.password !== f.confirmPassword) e.confirmPassword = 'Passwords do not match.'
  return e
}

const emptyStudentForm = (): StudentFormState => ({
  fullName: '',
  email: '',
  mobile: '',
  university: '',
  universityOther: '',
  collegeName: '',
  semester: '',
  collegeRegNo: '',
  course: '',
  branch: '',
  branchOther: '',
  subject: '',
  subjectOther: '',
  courseOther: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
})

export function Register() {
  const navigate = useNavigate()
  const { setUser, setToken } = useAuthStore()
  const [tab, setTab] = useState<Tab>('student')
  const [authError, setAuthError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [authLoading, setAuthLoading] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [successToastText, setSuccessToastText] = useState('')
  const [showStudentPassword, setShowStudentPassword] = useState(false)
  const [showStudentConfirm, setShowStudentConfirm] = useState(false)
  const [showCompanyPassword, setShowCompanyPassword] = useState(false)
  const [showCompanyConfirm, setShowCompanyConfirm] = useState(false)

  const [studentForm, setStudentForm] = useState<StudentFormState>(emptyStudentForm)

  const [otpOpen, setOtpOpen] = useState(false)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [otpDeadline, setOtpDeadline] = useState<number>(0)
  const [otpRemainingLabel, setOtpRemainingLabel] = useState('10:00')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [otpSubmitting, setOtpSubmitting] = useState(false)
  const [resendCooldownUntil, setResendCooldownUntil] = useState(0)
  const [tick, setTick] = useState(0)
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([])

  const [companyForm, setCompanyForm] = useState<CompanyFormState>({
    companyName: '',
    companyEmail: '',
    mobile: '',
    industryType: '',
    address: '',
    website: '',
    hrName: '',
    hrMobile: '',
    password: '',
    confirmPassword: '',
  })
  const [companyFieldErrors, setCompanyFieldErrors] = useState<Record<string, string>>({})

  const [companyOtpOpen, setCompanyOtpOpen] = useState(false)
  const [companyVerificationId, setCompanyVerificationId] = useState<string | null>(null)
  const [companyOtpDeadline, setCompanyOtpDeadline] = useState(0)
  const [companyOtpRemainingLabel, setCompanyOtpRemainingLabel] = useState('10:00')
  const [companyOtpDigits, setCompanyOtpDigits] = useState(['', '', '', '', '', ''])
  const [companyOtpError, setCompanyOtpError] = useState('')
  const [companyOtpSubmitting, setCompanyOtpSubmitting] = useState(false)
  const [companyResendCooldownUntil, setCompanyResendCooldownUntil] = useState(0)
  const [companyTick, setCompanyTick] = useState(0)
  const [companyOtpAttemptsLabel, setCompanyOtpAttemptsLabel] = useState('')
  const companyOtpInputRefs = useRef<Array<HTMLInputElement | null>>([])

  const updateOtpTimer = useCallback(() => {
    const ms = otpDeadline - Date.now()
    if (ms <= 0) {
      setOtpRemainingLabel('00:00')
      return
    }
    const total = Math.floor(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    setOtpRemainingLabel(`${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`)
  }, [otpDeadline])

  useEffect(() => {
    if (!otpOpen || !otpDeadline) return
    updateOtpTimer()
    const t = window.setInterval(updateOtpTimer, 1000)
    return () => window.clearInterval(t)
  }, [otpOpen, otpDeadline, updateOtpTimer])

  useEffect(() => {
    if (!otpOpen) return
    const t = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [otpOpen])

  const updateCompanyOtpTimer = useCallback(() => {
    const ms = companyOtpDeadline - Date.now()
    if (ms <= 0) {
      setCompanyOtpRemainingLabel('00:00')
      return
    }
    const total = Math.floor(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    setCompanyOtpRemainingLabel(`${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`)
  }, [companyOtpDeadline])

  useEffect(() => {
    if (!companyOtpOpen || !companyOtpDeadline || !companyVerificationId) return
    updateCompanyOtpTimer()
    const t = window.setInterval(updateCompanyOtpTimer, 1000)
    return () => window.clearInterval(t)
  }, [companyOtpOpen, companyOtpDeadline, companyVerificationId, updateCompanyOtpTimer])

  useEffect(() => {
    if (!companyOtpOpen) return
    const t = window.setInterval(() => setCompanyTick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [companyOtpOpen])

  const resetOtpUi = () => {
    setOtpOpen(false)
    setVerificationId(null)
    setOtpDigits(['', '', '', '', '', ''])
    setOtpError('')
    setOtpDeadline(0)
  }

  const resetCompanyOtpUi = () => {
    setCompanyOtpOpen(false)
    setCompanyVerificationId(null)
    setCompanyOtpDigits(['', '', '', '', '', ''])
    setCompanyOtpError('')
    setCompanyOtpDeadline(0)
    setCompanyOtpAttemptsLabel('')
  }

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setFieldErrors({})
    const local = validateStudentForm(studentForm)
    if (Object.keys(local).length) {
      setFieldErrors(local)
      return
    }
    setAuthLoading(true)
    try {
      const res = await authService.register({
        fullName: studentForm.fullName.trim(),
        email: studentForm.email.trim().toLowerCase(),
        password: studentForm.password,
        confirmPassword: studentForm.confirmPassword,
        mobile: studentForm.mobile,
        university: studentForm.university,
        universityOther: studentForm.university === OTHER_OPTION_VALUE ? studentForm.universityOther.trim() : undefined,
        collegeName: studentForm.collegeName.trim(),
        semester: studentForm.semester,
        collegeRegNo: studentForm.collegeRegNo.trim(),
        course: studentForm.course,
        branch: studentForm.course === 'B.Tech' || studentForm.course === 'Diploma' ? studentForm.branch : undefined,
        branchOther:
          studentForm.branch === BRANCH_OTHERS_LABEL ? studentForm.branchOther.trim() : undefined,
        subject:
          ['B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA'].includes(studentForm.course) ? studentForm.subject : undefined,
        subjectOther:
          studentForm.subject === OTHER_OPTION_VALUE ? studentForm.subjectOther.trim() : undefined,
        courseOther: studentForm.course === OTHER_OPTION_VALUE ? studentForm.courseOther.trim() : undefined,
        acceptTerms: true,
        role: 'student',
      })
      if (res.verificationId) {
        setVerificationId(res.verificationId)
        const sec = typeof res.expiresInSeconds === 'number' ? res.expiresInSeconds : 600
        setOtpDeadline(Date.now() + sec * 1000)
        setResendCooldownUntil(Date.now() + 30_000)
        setOtpOpen(true)
        setOtpDigits(['', '', '', '', '', ''])
        setOtpError('')
        window.setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; fields?: Record<string, string> } } }
      const data = ax.response?.data
      if (data?.fields && typeof data.fields === 'object') {
        setFieldErrors(data.fields)
      }
      setAuthError(data?.error || 'Registration failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join('')
    if (otp.length !== 6 || !verificationId) {
      setOtpError('Enter the 6-digit code.')
      return
    }
    setOtpError('')
    setOtpSubmitting(true)
    try {
      const res = await authService.verifyRegisterOtp(verificationId, otp)
      setToken(res.token)
      setUser(res.user as AuthUser)
      resetOtpUi()
      setSuccessToastText('Account created successfully! Welcome to XpertIntern.')
      setShowSuccessToast(true)
      window.setTimeout(() => navigate('/dashboard', { replace: true }), 1800)
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; attemptsRemaining?: number; code?: string } } }
      const data = ax.response?.data
      setOtpError(data?.error || 'Verification failed')
    } finally {
      setOtpSubmitting(false)
    }
  }

  const handleResendOtp = async () => {
    if (!verificationId || Date.now() < resendCooldownUntil) return
    setOtpError('')
    setAuthLoading(true)
    try {
      const res = await authService.resendRegisterOtp(verificationId)
      if (res.message) {
        const sec = 600
        setOtpDeadline(Date.now() + sec * 1000)
        setResendCooldownUntil(Date.now() + 30_000)
        setOtpDigits(['', '', '', '', '', ''])
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; retryAfterSeconds?: number } } }
      const data = ax.response?.data
      if (typeof data?.retryAfterSeconds === 'number') {
        setResendCooldownUntil(Date.now() + data.retryAfterSeconds * 1000)
      }
      setOtpError(data?.error || 'Could not resend code.')
    } finally {
      setAuthLoading(false)
    }
  }

  const onOtpDigit = (index: number, val: string) => {
    const d = val.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = d
    setOtpDigits(next)
    if (d && index < 5) otpInputRefs.current[index + 1]?.focus()
  }

  const onOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const onOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const raw = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < raw.length; i++) next[i] = raw[i]!
    setOtpDigits(next)
    otpInputRefs.current[Math.min(raw.length, 5)]?.focus()
  }

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setCompanyFieldErrors({})
    const local = validateCompanyForm(companyForm)
    if (Object.keys(local).length) {
      setCompanyFieldErrors(local)
      return
    }
    setCompanyOtpError('')
    setAuthLoading(true)
    try {
      const res = await authService.companyRegister({
        companyName: companyForm.companyName.trim(),
        companyEmail: companyForm.companyEmail.trim().toLowerCase(),
        mobile: companyForm.mobile,
        password: companyForm.password,
        confirmPassword: companyForm.confirmPassword,
        hrName: companyForm.hrName.trim(),
        hrMobile: companyForm.hrMobile,
        industryType: companyForm.industryType,
        address: companyForm.address.trim(),
        website: companyForm.website.trim() || undefined,
        otpChannel: 'email',
      })
      if (res.verificationId) {
        setCompanyVerificationId(res.verificationId)
        const sec = typeof res.expiresInSeconds === 'number' ? res.expiresInSeconds : 600
        setCompanyOtpDeadline(Date.now() + sec * 1000)
        setCompanyResendCooldownUntil(Date.now() + 30_000)
        setCompanyOtpDigits(['', '', '', '', '', ''])
        setCompanyOtpAttemptsLabel('')
        setCompanyOtpOpen(true)
        window.setTimeout(() => companyOtpInputRefs.current[0]?.focus(), 100)
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; fields?: Record<string, string>; code?: string } } }
      const data = ax.response?.data
      if (data?.fields && typeof data.fields === 'object') {
        setCompanyFieldErrors(data.fields)
      }
      setAuthError(data?.error || 'Could not send verification code.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerifyCompanyOtp = async () => {
    const otp = companyOtpDigits.join('')
    if (otp.length !== 6 || !companyVerificationId) {
      setCompanyOtpError('Enter the 6-digit code.')
      return
    }
    setCompanyOtpError('')
    setCompanyOtpSubmitting(true)
    setCompanyOtpAttemptsLabel('')
    try {
      const res = await authService.companyVerifyRegisterOtp(companyVerificationId, otp)
      resetCompanyOtpUi()
      setCompanyForm({
        companyName: '',
        companyEmail: '',
        mobile: '',
        industryType: '',
        address: '',
        website: '',
        hrName: '',
        hrMobile: '',
        password: '',
        confirmPassword: '',
      })
      setSuccessToastText(res.message || 'Registration submitted! You will receive an email once your account is approved.')
      setShowSuccessToast(true)
      window.setTimeout(() => navigate('/login', { replace: true }), 2200)
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; attemptsRemaining?: number; code?: string } } }
      const data = ax.response?.data
      setCompanyOtpError(data?.error || 'Verification failed')
      if (typeof data?.attemptsRemaining === 'number' && data.attemptsRemaining > 0) {
        setCompanyOtpAttemptsLabel(`Attempt ${3 - data.attemptsRemaining} of 3`)
      }
    } finally {
      setCompanyOtpSubmitting(false)
    }
  }

  const handleResendCompanyOtp = async () => {
    if (!companyVerificationId || Date.now() < companyResendCooldownUntil) return
    setCompanyOtpError('')
    setAuthLoading(true)
    try {
      await authService.companyResendRegisterOtp(companyVerificationId)
      const sec = 600
      setCompanyOtpDeadline(Date.now() + sec * 1000)
      setCompanyResendCooldownUntil(Date.now() + 30_000)
      setCompanyOtpDigits(['', '', '', '', '', ''])
      setCompanyOtpAttemptsLabel('')
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; retryAfterSeconds?: number } } }
      const data = ax.response?.data
      if (typeof data?.retryAfterSeconds === 'number') {
        setCompanyResendCooldownUntil(Date.now() + data.retryAfterSeconds * 1000)
      }
      setCompanyOtpError(data?.error || 'Could not resend code.')
    } finally {
      setAuthLoading(false)
    }
  }

  const onCompanyOtpDigit = (index: number, val: string) => {
    const d = val.replace(/\D/g, '').slice(-1)
    const next = [...companyOtpDigits]
    next[index] = d
    setCompanyOtpDigits(next)
    if (d && index < 5) companyOtpInputRefs.current[index + 1]?.focus()
  }

  const onCompanyOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !companyOtpDigits[index] && index > 0) {
      companyOtpInputRefs.current[index - 1]?.focus()
    }
  }

  const onCompanyOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const raw = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < raw.length; i++) next[i] = raw[i]!
    setCompanyOtpDigits(next)
    companyOtpInputRefs.current[Math.min(raw.length, 5)]?.focus()
  }

  const _resendSecLeft = Math.max(0, Math.ceil((resendCooldownUntil - Date.now()) / 1000))
  const _companyResendSecLeft = Math.max(0, Math.ceil((companyResendCooldownUntil - Date.now()) / 1000))
  void tick
  void companyTick

  return (
    <div className="min-h-screen bg-gray-100/80 flex items-center justify-center px-4 py-10 sm:py-16 min-w-0 relative">
      {showSuccessToast && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 shadow-lg animate-fade-in"
        >
          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
          <span className="font-medium">{successToastText}</span>
        </div>
      )}

      {otpOpen && verificationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="otp-title">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h2 id="otp-title" className="text-lg font-bold text-brand-navy">Verify Your Account</h2>
            <p className="mt-2 text-sm text-gray-600">
              An OTP has been sent to: <span className="font-medium text-gray-800">Email: {maskEmail(studentForm.email.trim())}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">Enter the 6-digit code from your inbox.</p>

            <div className="mt-4 flex justify-center gap-2" onPaste={onOtpPaste}>
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { otpInputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={d}
                  onChange={(e) => onOtpDigit(i, e.target.value)}
                  onKeyDown={(e) => onOtpKeyDown(i, e)}
                  className="h-12 w-10 rounded-lg border border-gray-300 text-center text-lg font-semibold focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                />
              ))}
            </div>
            {otpError && <p className="mt-3 text-sm text-red-600">{otpError}</p>}

            <p className="mt-4 text-center text-sm text-gray-600">
              <span className="font-medium">⏱ {otpRemainingLabel}</span> remaining
            </p>

            <button
              type="button"
              disabled={otpSubmitting}
              onClick={handleVerifyOtp}
              className="mt-4 w-full rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition disabled:opacity-50"
            >
              {otpSubmitting ? 'Verifying…' : 'Verify & Create Account'}
            </button>

            <div className="mt-4 flex flex-col items-center gap-2 text-sm">
              <button
                type="button"
                disabled={_resendSecLeft > 0 || authLoading}
                onClick={handleResendOtp}
                className="text-brand-accent font-medium hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {_resendSecLeft > 0
                  ? `Resend OTP (available in ${_resendSecLeft}s)`
                  : 'Resend OTP'}
              </button>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-900 underline text-xs"
                onClick={() => {
                  resetOtpUi()
                  setStudentForm((f) => ({ ...f, email: f.email }))
                }}
              >
                Edit registration details
              </button>
            </div>
          </div>
        </div>
      )}

      {companyOtpOpen && companyVerificationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="company-otp-title">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 id="company-otp-title" className="text-lg font-bold text-brand-navy">Verify your company email</h2>
            <p className="mt-2 text-sm text-gray-600">
              We sent a 6-digit code to{' '}
              <span className="font-medium text-gray-800">{maskEmail(companyForm.companyEmail.trim().toLowerCase())}</span>
              . Enter it below to submit your registration for admin review.
            </p>
            <div className="mt-4 flex justify-center gap-2" onPaste={onCompanyOtpPaste}>
              {companyOtpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { companyOtpInputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={d}
                  onChange={(e) => onCompanyOtpDigit(i, e.target.value)}
                  onKeyDown={(e) => onCompanyOtpKeyDown(i, e)}
                  className="h-12 w-10 rounded-lg border border-gray-300 text-center text-lg font-semibold focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                />
              ))}
            </div>
            {companyOtpError ? <p className="mt-3 text-sm text-red-600">{companyOtpError}</p> : null}
            {companyOtpAttemptsLabel ? <p className="mt-2 text-sm text-gray-600">{companyOtpAttemptsLabel}</p> : null}
            <p className="mt-4 text-center text-sm text-gray-600">
              <span className="font-medium">⏱ {companyOtpRemainingLabel}</span> remaining
            </p>
            <button
              type="button"
              disabled={companyOtpSubmitting}
              onClick={handleVerifyCompanyOtp}
              className="mt-4 w-full rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition disabled:opacity-50"
            >
              {companyOtpSubmitting ? 'Verifying…' : 'Verify & Submit Registration'}
            </button>
            <div className="mt-4 flex flex-col items-center gap-2 text-sm">
              <button
                type="button"
                disabled={_companyResendSecLeft > 0 || authLoading}
                onClick={handleResendCompanyOtp}
                className="text-brand-accent font-medium hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {_companyResendSecLeft > 0
                  ? `Resend OTP (available in ${_companyResendSecLeft}s)`
                  : 'Resend OTP'}
              </button>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-900 underline text-xs"
                onClick={() => {
                  resetCompanyOtpUi()
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setTab('student')}
              className={`flex-1 py-3.5 text-sm font-semibold transition ${tab === 'student' ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Student Sign Up
            </button>
            <button
              type="button"
              onClick={() => setTab('company')}
              className={`flex-1 py-3.5 text-sm font-semibold transition ${tab === 'company' ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Company Sign Up
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {tab === 'student' ? (
              <>
                <h1 className="text-xl font-bold text-brand-navy sm:text-2xl">Create Student Account</h1>
                {authError && !Object.keys(fieldErrors).length ? <p className="mt-4 text-sm text-red-600">{authError}</p> : null}
                <form onSubmit={handleStudentSubmit} className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Your full name"
                        value={studentForm.fullName}
                        onChange={(e) => setStudentForm((f) => ({ ...f, fullName: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${fieldErrors.fullName ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {fieldErrors.fullName ? <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p> : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email ID *</label>
                      <input
                        type="email"
                        required
                        placeholder="your@email.com"
                        value={studentForm.email}
                        onChange={(e) => setStudentForm((f) => ({ ...f, email: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${fieldErrors.email ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {fieldErrors.email ? <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p> : null}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Mobile Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 XXXXXXXXXX"
                        value={studentForm.mobile}
                        onChange={(e) => setStudentForm((f) => ({ ...f, mobile: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${fieldErrors.mobile ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {fieldErrors.mobile ? <p className="mt-1 text-xs text-red-600">{fieldErrors.mobile}</p> : null}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">University *</label>
                    <select
                      required
                      value={studentForm.university}
                      onChange={(e) => {
                        const v = e.target.value
                        setStudentForm((f) => ({
                          ...f,
                          university: v,
                          universityOther: v === OTHER_OPTION_VALUE ? f.universityOther : '',
                        }))
                      }}
                      className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-700 focus:ring-1 ${fieldErrors.university ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                    >
                      <option value="">Select University</option>
                      {REGISTRATION_UNIVERSITIES_LIST.map((u) => (
                        <option key={u.name} value={u.name}>
                          {u.name === OTHER_OPTION_VALUE ? u.shortForm : `${u.shortForm} — ${u.name}`}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.university ? <p className="mt-1 text-xs text-red-600">{fieldErrors.university}</p> : null}
                  </div>
                  {studentForm.university === OTHER_OPTION_VALUE ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Please specify your university name *</label>
                      <input
                        type="text"
                        required
                        value={studentForm.universityOther}
                        onChange={(e) => setStudentForm((f) => ({ ...f, universityOther: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${fieldErrors.universityOther ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {fieldErrors.universityOther ? <p className="mt-1 text-xs text-red-600">{fieldErrors.universityOther}</p> : null}
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">College Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Your college name"
                      value={studentForm.collegeName}
                      onChange={(e) => setStudentForm((f) => ({ ...f, collegeName: e.target.value }))}
                      className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${fieldErrors.collegeName ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                    />
                    {fieldErrors.collegeName ? <p className="mt-1 text-xs text-red-600">{fieldErrors.collegeName}</p> : null}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Semester *</label>
                      <select
                        required
                        value={studentForm.semester}
                        onChange={(e) => setStudentForm((f) => ({ ...f, semester: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-700 focus:ring-1 ${fieldErrors.semester ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      >
                        <option value="">Select Semester</option>
                        {SEMESTERS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {fieldErrors.semester ? <p className="mt-1 text-xs text-red-600">{fieldErrors.semester}</p> : null}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">College Registration Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="College reg. number"
                        value={studentForm.collegeRegNo}
                        onChange={(e) => setStudentForm((f) => ({ ...f, collegeRegNo: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${fieldErrors.collegeRegNo ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {fieldErrors.collegeRegNo ? <p className="mt-1 text-xs text-red-600">{fieldErrors.collegeRegNo}</p> : null}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Course *</label>
                    <select
                      required
                      value={studentForm.course}
                      onChange={(e) => {
                        const c = e.target.value
                        setStudentForm((f) => ({
                          ...f,
                          course: c,
                          branch: '',
                          branchOther: '',
                          subject: '',
                          subjectOther: '',
                          courseOther: '',
                        }))
                      }}
                      className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-700 focus:ring-1 ${fieldErrors.course ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                    >
                      <option value="">Select Course</option>
                      {STUDENT_COURSES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value={OTHER_OPTION_VALUE}>Other</option>
                    </select>
                    {fieldErrors.course ? <p className="mt-1 text-xs text-red-600">{fieldErrors.course}</p> : null}
                  </div>

                  {studentForm.course === OTHER_OPTION_VALUE ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Please specify your course name *</label>
                      <input
                        type="text"
                        required
                        value={studentForm.courseOther}
                        onChange={(e) => setStudentForm((f) => ({ ...f, courseOther: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${fieldErrors.courseOther ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {fieldErrors.courseOther ? <p className="mt-1 text-xs text-red-600">{fieldErrors.courseOther}</p> : null}
                    </div>
                  ) : null}

                  {(studentForm.course === 'B.Tech' || studentForm.course === 'Diploma') ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Branch *</label>
                      <select
                        required
                        value={studentForm.branch}
                        onChange={(e) => {
                          const b = e.target.value
                          setStudentForm((f) => ({ ...f, branch: b, branchOther: b === BRANCH_OTHERS_LABEL ? f.branchOther : '' }))
                        }}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-700 focus:ring-1 ${fieldErrors.branch ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      >
                        <option value="">Select Branch</option>
                        {BRANCHES_66.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      {fieldErrors.branch ? <p className="mt-1 text-xs text-red-600">{fieldErrors.branch}</p> : null}
                    </div>
                  ) : null}

                  {studentForm.branch === BRANCH_OTHERS_LABEL && (studentForm.course === 'B.Tech' || studentForm.course === 'Diploma') ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Please specify your branch *</label>
                      <input
                        type="text"
                        required
                        value={studentForm.branchOther}
                        onChange={(e) => setStudentForm((f) => ({ ...f, branchOther: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${fieldErrors.branchOther ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {fieldErrors.branchOther ? <p className="mt-1 text-xs text-red-600">{fieldErrors.branchOther}</p> : null}
                    </div>
                  ) : null}

                  {['B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA'].includes(studentForm.course) ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Subject *</label>
                      <select
                        required
                        value={studentForm.subject}
                        onChange={(e) => {
                          const s = e.target.value
                          setStudentForm((f) => ({ ...f, subject: s, subjectOther: s === OTHER_OPTION_VALUE ? f.subjectOther : '' }))
                        }}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-700 focus:ring-1 ${fieldErrors.subject ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      >
                        <option value="">Select Subject</option>
                        {subjectOptionsForCourse(studentForm.course).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {fieldErrors.subject ? <p className="mt-1 text-xs text-red-600">{fieldErrors.subject}</p> : null}
                    </div>
                  ) : null}

                  {studentForm.subject === OTHER_OPTION_VALUE && ['B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA'].includes(studentForm.course) ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Please specify your subject *</label>
                      <input
                        type="text"
                        required
                        value={studentForm.subjectOther}
                        onChange={(e) => setStudentForm((f) => ({ ...f, subjectOther: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${fieldErrors.subjectOther ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {fieldErrors.subjectOther ? <p className="mt-1 text-xs text-red-600">{fieldErrors.subjectOther}</p> : null}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password *</label>
                      <div className="mt-1 relative">
                        <input
                          type={showStudentPassword ? 'text' : 'password'}
                          required
                          placeholder="Create password"
                          value={studentForm.password}
                          onChange={(e) => setStudentForm((f) => ({ ...f, password: e.target.value }))}
                          className={`block w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:ring-1 ${fieldErrors.password ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                        />
                        <button type="button" onClick={() => setShowStudentPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none" aria-label={showStudentPassword ? 'Hide password' : 'Show password'}>{showStudentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                      </div>
                      {fieldErrors.password ? <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p> : null}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Confirm Password *</label>
                      <div className="mt-1 relative">
                        <input
                          type={showStudentConfirm ? 'text' : 'password'}
                          required
                          placeholder="Confirm password"
                          value={studentForm.confirmPassword}
                          onChange={(e) => setStudentForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                          className={`block w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:ring-1 ${fieldErrors.confirmPassword ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                        />
                        <button type="button" onClick={() => setShowStudentConfirm((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none" aria-label={showStudentConfirm ? 'Hide password' : 'Show password'}>{showStudentConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                      </div>
                      {fieldErrors.confirmPassword ? <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p> : null}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="accept-terms"
                      required
                      checked={studentForm.acceptTerms}
                      onChange={(e) => setStudentForm((f) => ({ ...f, acceptTerms: e.target.checked }))}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                    />
                    <label htmlFor="accept-terms" className="text-sm text-gray-700">
                      I accept the <Link to="/terms" className="font-medium text-brand-accent hover:underline">Terms & Conditions</Link>
                    </label>
                  </div>
                  {fieldErrors.acceptTerms ? <p className="text-xs text-red-600">{fieldErrors.acceptTerms}</p> : null}

                  <button
                    type="submit"
                    disabled={!studentForm.acceptTerms || authLoading || otpOpen}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {authLoading ? 'Sending code…' : 'Create Account'} <User className="h-4 w-4" />
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-brand-navy sm:text-2xl">Register Your Company</h1>
                {authError && !Object.keys(companyFieldErrors).length ? <p className="mt-4 text-sm text-red-600">{authError}</p> : null}
                <form onSubmit={handleCompanySubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Company name"
                      value={companyForm.companyName}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, companyName: e.target.value }))}
                      className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${companyFieldErrors.companyName ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                    />
                    {companyFieldErrors.companyName ? <p className="mt-1 text-xs text-red-600">{companyFieldErrors.companyName}</p> : null}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Company Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="info@company.com"
                        value={companyForm.companyEmail}
                        onChange={(e) => setCompanyForm((f) => ({ ...f, companyEmail: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${companyFieldErrors.companyEmail ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {companyFieldErrors.companyEmail ? <p className="mt-1 text-xs text-red-600">{companyFieldErrors.companyEmail}</p> : null}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Mobile Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 XXXXXXXXXX"
                        value={companyForm.mobile}
                        onChange={(e) => setCompanyForm((f) => ({ ...f, mobile: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${companyFieldErrors.mobile ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {companyFieldErrors.mobile ? <p className="mt-1 text-xs text-red-600">{companyFieldErrors.mobile}</p> : null}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Industry Type *</label>
                    <select
                      required
                      value={companyForm.industryType}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, industryType: e.target.value }))}
                      className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-700 focus:ring-1 ${companyFieldErrors.industryType ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                    >
                      <option value="" disabled>Select Industry</option>
                      {DPIIT_INDUSTRY_SECTORS.map((i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                    {companyFieldErrors.industryType ? <p className="mt-1 text-xs text-red-600">{companyFieldErrors.industryType}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company Address *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Full company address"
                      value={companyForm.address}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, address: e.target.value }))}
                      className={`mt-1 block w-full resize-none rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${companyFieldErrors.address ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                    />
                    {companyFieldErrors.address ? <p className="mt-1 text-xs text-red-600">{companyFieldErrors.address}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Website (Optional)</label>
                    <input
                      type="text"
                      placeholder="https://company.com"
                      value={companyForm.website}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, website: e.target.value }))}
                      className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${companyFieldErrors.website ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                    />
                    {companyFieldErrors.website ? <p className="mt-1 text-xs text-red-600">{companyFieldErrors.website}</p> : null}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">HR Contact Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="HR person name"
                        value={companyForm.hrName}
                        onChange={(e) => setCompanyForm((f) => ({ ...f, hrName: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${companyFieldErrors.hrName ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {companyFieldErrors.hrName ? <p className="mt-1 text-xs text-red-600">{companyFieldErrors.hrName}</p> : null}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">HR Mobile *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 XXXXXXXXXX"
                        value={companyForm.hrMobile}
                        onChange={(e) => setCompanyForm((f) => ({ ...f, hrMobile: e.target.value }))}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 ${companyFieldErrors.hrMobile ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                      />
                      {companyFieldErrors.hrMobile ? <p className="mt-1 text-xs text-red-600">{companyFieldErrors.hrMobile}</p> : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password *</label>
                      <div className="mt-1 relative">
                        <input
                          type={showCompanyPassword ? 'text' : 'password'}
                          required
                          placeholder="Create password"
                          value={companyForm.password}
                          onChange={(e) => setCompanyForm((f) => ({ ...f, password: e.target.value }))}
                          className={`block w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:ring-1 ${companyFieldErrors.password ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                        />
                        <button type="button" onClick={() => setShowCompanyPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none" aria-label={showCompanyPassword ? 'Hide password' : 'Show password'}>{showCompanyPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                      </div>
                      {companyFieldErrors.password ? <p className="mt-1 text-xs text-red-600">{companyFieldErrors.password}</p> : null}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Confirm Password *</label>
                      <div className="mt-1 relative">
                        <input
                          type={showCompanyConfirm ? 'text' : 'password'}
                          required
                          placeholder="Confirm password"
                          value={companyForm.confirmPassword}
                          onChange={(e) => setCompanyForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                          className={`block w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:ring-1 ${companyFieldErrors.confirmPassword ? 'border-red-400' : 'border-gray-300 focus:border-brand-accent focus:ring-brand-accent'}`}
                        />
                        <button type="button" onClick={() => setShowCompanyConfirm((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none" aria-label={showCompanyConfirm ? 'Hide password' : 'Show password'}>{showCompanyConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                      </div>
                      {companyFieldErrors.confirmPassword ? <p className="mt-1 text-xs text-red-600">{companyFieldErrors.confirmPassword}</p> : null}
                    </div>
                  </div>
                  <div className="flex gap-2 rounded-lg bg-brand-light-bg border border-primary-200 p-3">
                    <Info className="h-5 w-5 shrink-0 text-brand-accent" />
                    <p className="text-sm text-gray-700">Company registration requires admin approval. You will receive an email notification once your account is approved.</p>
                  </div>
                  <button type="submit" disabled={authLoading || companyOtpOpen} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy py-2.5 text-sm font-semibold text-white hover:bg-primary-800 transition disabled:opacity-50">
                    {authLoading ? 'Sending code…' : 'Register Company'} <Building2 className="h-4 w-4" />
                  </button>
                </form>
              </>
            )}

            <p className="mt-6 text-center text-sm text-gray-600">
              Already have an account? <Link to="/login" className="font-semibold text-brand-accent hover:underline">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
