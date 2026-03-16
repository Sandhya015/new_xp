import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Building2, Info, CheckCircle } from 'lucide-react'
import { authService } from '@/services/authService'

const UNIVERSITIES = [
  'BEU — Bihar Engineering University', 'SBTE — State Board of Technical Education', 'JUT — Jharkhand University of Technology',
  'AKTU — Dr. A.P.J. Abdul Kalam Technical Univ.', 'Patna University', 'Patliputra University', 'Munger University',
  'Lalit Narayan Mithila University', 'Veer Kunwar Singh University', 'Tilka Majhi Bhagalpur University',
  'Bhupendra Narayan Mandal University', 'Jai Prakash University', 'Magadh University', 'Purnea University',
  'Nalanda Open University', 'Babasaheb Bhimrao Ambedkar Bihar University',
]
const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
const COURSES = ['B.Tech', 'Diploma', 'BA', 'BSc', 'BCom', 'BBA', 'BCA']
const STREAMS = ['CSE', 'Civil', 'Electrical', 'ECE', 'Mechanical', 'IT']
const INDUSTRIES = ['IT / Software', 'Manufacturing', 'Education', 'Healthcare', 'Finance', 'Retail', 'Other']

type Tab = 'student' | 'company'

const TOAST_DURATION_MS = 2500

export function Register() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('student')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [studentForm, setStudentForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    university: '',
    collegeName: '',
    semester: '',
    collegeRegNo: '',
    course: '',
    stream: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    linkedin: '',
  })
  const [companyForm, setCompanyForm] = useState({
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

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      await authService.register({
        name: studentForm.fullName,
        email: studentForm.email,
        password: studentForm.password,
        mobile: studentForm.mobile,
      })
      setShowSuccessToast(true)
      setTimeout(() => navigate('/login'), TOAST_DURATION_MS)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Registration failed'
      setAuthError(msg || 'Registration failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      await authService.register({
        name: companyForm.companyName,
        email: companyForm.companyEmail,
        password: companyForm.password,
        mobile: companyForm.mobile,
        role: 'company',
        hrName: companyForm.hrName,
      })
      setShowSuccessToast(true)
      setTimeout(() => navigate('/login'), TOAST_DURATION_MS)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Registration failed'
      setAuthError(msg || 'Registration failed')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100/80 flex items-center justify-center px-4 py-10 sm:py-16 min-w-0 relative">
      {/* Success toast */}
      {showSuccessToast && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 shadow-lg animate-fade-in"
        >
          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
          <span className="font-medium">Registered successfully.</span>
          <span className="text-sm">Redirecting to login...</span>
        </div>
      )}
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {/* Tabs */}
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
                {authError && <p className="mt-4 text-sm text-red-600">{authError}</p>}
                <form onSubmit={handleStudentSubmit} className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                      <input type="text" required placeholder="Your full name" value={studentForm.fullName} onChange={(e) => setStudentForm((f) => ({ ...f, fullName: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email ID *</label>
                      <input type="email" required placeholder="your@email.com" value={studentForm.email} onChange={(e) => setStudentForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Mobile Number *</label>
                    <input type="tel" required placeholder="+91 XXXXXXXXXX" value={studentForm.mobile} onChange={(e) => setStudentForm((f) => ({ ...f, mobile: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">University *</label>
                    <select required value={studentForm.university} onChange={(e) => setStudentForm((f) => ({ ...f, university: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                      <option value="">Select University</option>
                      {UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">College Name *</label>
                    <input type="text" required placeholder="Your college name" value={studentForm.collegeName} onChange={(e) => setStudentForm((f) => ({ ...f, collegeName: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Semester *</label>
                      <select required value={studentForm.semester} onChange={(e) => setStudentForm((f) => ({ ...f, semester: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                        <option value="">Select Semester</option>
                        {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">College Registration Number *</label>
                      <input type="text" required placeholder="College reg. number" value={studentForm.collegeRegNo} onChange={(e) => setStudentForm((f) => ({ ...f, collegeRegNo: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Course *</label>
                      <select required value={studentForm.course} onChange={(e) => setStudentForm((f) => ({ ...f, course: e.target.value, stream: '' }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                        <option value="">Select Course</option>
                        {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {(studentForm.course === 'B.Tech' || studentForm.course === 'Diploma') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Stream *</label>
                        <select required value={studentForm.stream} onChange={(e) => setStudentForm((f) => ({ ...f, stream: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                          <option value="">Select Stream</option>
                          {STREAMS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password *</label>
                      <input type="password" required placeholder="Create password" value={studentForm.password} onChange={(e) => setStudentForm((f) => ({ ...f, password: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Confirm Password *</label>
                      <input type="password" required placeholder="Confirm password" value={studentForm.confirmPassword} onChange={(e) => setStudentForm((f) => ({ ...f, confirmPassword: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">LinkedIn Profile (Optional)</label>
                    <input type="url" placeholder="https://linkedin.com/in/..." value={studentForm.linkedin} onChange={(e) => setStudentForm((f) => ({ ...f, linkedin: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Resume Upload (Optional)</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input type="file" accept=".pdf,.doc,.docx" className="hidden" id="resume" />
                      <label htmlFor="resume" className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Choose File</label>
                      <span className="text-sm text-gray-500">No file chosen</span>
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
                  <button type="submit" disabled={!studentForm.acceptTerms || authLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    {authLoading ? 'Creating account...' : 'Create Account'} <User className="h-4 w-4" />
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-brand-navy sm:text-2xl">Register Your Company</h1>
                {authError && <p className="mt-4 text-sm text-red-600">{authError}</p>}
                <form onSubmit={handleCompanySubmit} className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Company Name *</label>
                      <input type="text" required placeholder="Company name" value={companyForm.companyName} onChange={(e) => setCompanyForm((f) => ({ ...f, companyName: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Company Email *</label>
                      <input type="email" required placeholder="info@company.com" value={companyForm.companyEmail} onChange={(e) => setCompanyForm((f) => ({ ...f, companyEmail: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Mobile Number *</label>
                    <input type="tel" required placeholder="+91 XXXXXXXXXX" value={companyForm.mobile} onChange={(e) => setCompanyForm((f) => ({ ...f, mobile: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Industry Type *</label>
                    <select required value={companyForm.industryType} onChange={(e) => setCompanyForm((f) => ({ ...f, industryType: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                      <option value="">Select Industry</option>
                      {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company Address *</label>
                    <textarea required rows={3} placeholder="Full company address" value={companyForm.address} onChange={(e) => setCompanyForm((f) => ({ ...f, address: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Website (Optional)</label>
                    <input type="url" placeholder="https://company.com" value={companyForm.website} onChange={(e) => setCompanyForm((f) => ({ ...f, website: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">HR Contact Name *</label>
                      <input type="text" required placeholder="HR person name" value={companyForm.hrName} onChange={(e) => setCompanyForm((f) => ({ ...f, hrName: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">HR Mobile *</label>
                      <input type="tel" required placeholder="+91 XXXXXXXXXX" value={companyForm.hrMobile} onChange={(e) => setCompanyForm((f) => ({ ...f, hrMobile: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password *</label>
                      <input type="password" required placeholder="Create password" value={companyForm.password} onChange={(e) => setCompanyForm((f) => ({ ...f, password: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Confirm Password *</label>
                      <input type="password" required placeholder="Confirm password" value={companyForm.confirmPassword} onChange={(e) => setCompanyForm((f) => ({ ...f, confirmPassword: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                    </div>
                  </div>
                  <div className="flex gap-2 rounded-lg bg-brand-light-bg border border-primary-200 p-3">
                    <Info className="h-5 w-5 shrink-0 text-brand-accent" />
                    <p className="text-sm text-gray-700">Company registration requires admin approval. You will receive an email notification once your account is approved.</p>
                  </div>
                  <button type="submit" disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy py-2.5 text-sm font-semibold text-white hover:bg-primary-800 transition disabled:opacity-50">
                    {authLoading ? 'Registering...' : 'Register Company'} <Building2 className="h-4 w-4" />
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
