import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { REGISTRATION_UNIVERSITIES_LIST } from '@/constants/registrationUniversities'
import {
  OTHER_OPTION_VALUE,
  STUDENT_COURSES,
  BRANCHES_66,
  subjectOptionsForCourse,
} from '@/constants/registrationLists'
import { REGISTRATION_COLLEGES_BY_UNIVERSITY, collegeOptionsFromList, isOtherCollege } from '@/constants/registrationColleges'
import { INDIAN_STATES_UTS } from '@/constants/indianRegions'
import { fetchTrainingCheckoutSettings, type TrainingCheckoutSettings } from '@/services/settingsService'
import { courseService } from '@/services/courseService'
import { paymentService } from '@/services/paymentService'
import { splitInrTaxInclusive, formatInr } from '@/utils/gstPricing'
import { absoluteApiUrl } from '@/config/api'

export type EnrollCourseLite = {
  id: string
  title: string
  price: number
  universities?: string
  mode?: string
  duration?: string
  featuredImageUrl?: string
  shortDescription?: string
}

type Props = {
  course: EnrollCourseLite | null
  /** Reset payment-gateway busy/error (same hook instance as startCheckout). */
  abandonCheckout?: () => void
  onClose: () => void
  startCheckout: (opts: {
    courseId: string
    courseTitle: string
    price: number
    prefill?: { name?: string; email?: string; contact?: string }
    couponCode?: string
    includeTrainingKit?: boolean
    enrollmentSnapshot?: Record<string, string | undefined>
    billingSnapshot?: Record<string, string | undefined>
    onSuccess?: () => void
  }) => Promise<void>
  payBusy: boolean
  payError: string | null
  clearPayError: () => void
}

function validEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

function applyCouponToCourseLine(
  courseGross: number,
  code: string,
  coupons: TrainingCheckoutSettings['coupons'],
) {
  const c = (code || '').trim().toUpperCase()
  if (!c) return { ok: true as const, gross: courseGross, message: '' }
  const row = coupons.find((x) => x.code === c)
  if (!row) return { ok: false as const, gross: courseGross, message: 'Invalid or expired coupon code.' }
  let disc = 0
  if (row.percentOff != null) {
    let d = (courseGross * row.percentOff) / 100
    if (row.maxDiscountInr != null && row.maxDiscountInr > 0) {
      d = Math.min(d, row.maxDiscountInr)
    }
    disc = d
  } else if (row.rupeesOff != null) {
    disc = row.rupeesOff
  }
  disc = Math.min(disc, courseGross)
  const next = Math.round(Math.max(0, courseGross - disc) * 100) / 100
  return { ok: true as const, gross: next, message: '' }
}

type KitMeta = { name: string; shortDescription: string; thumbnailUrl: string }

export function TrainingEnrollmentModal({
  course,
  abandonCheckout,
  onClose,
  startCheckout,
  payBusy,
  payError,
  clearPayError,
}: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [settings, setSettings] = useState<TrainingCheckoutSettings | null>(null)
  const [kitMeta, setKitMeta] = useState<KitMeta | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [university, setUniversity] = useState('')
  const [collegeName, setCollegeName] = useState('')
  const [collegeOther, setCollegeOther] = useState('')
  const [courseLevel, setCourseLevel] = useState('')
  const [branchOrSubject, setBranchOrSubject] = useState('')
  const [branchOther, setBranchOther] = useState('')
  const [semester, setSemester] = useState('1st')
  const [registrationNumber, setRegistrationNumber] = useState('')

  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState('')
  const [couponError, setCouponError] = useState<string | null>(null)
  const [includeKit, setIncludeKit] = useState(false)

  const [country, setCountry] = useState('India')
  const [street, setStreet] = useState('')
  const [apartment, setApartment] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!course?.id) {
      setSettings(null)
      setKitMeta(null)
      return
    }
    let cancelled = false
    setCheckoutLoading(true)
    courseService
      .getById(course.id)
      .then((detail: Record<string, unknown>) => {
        if (cancelled) return
        const ch = detail.checkout as
          | {
              gstPercent?: number
              trainingKit?: { priceInr?: number; name?: string; shortDescription?: string; thumbnailUrl?: string } | null
              coupons?: TrainingCheckoutSettings['coupons']
            }
          | undefined
        if (ch) {
          const tk = ch.trainingKit
          const price = typeof tk?.priceInr === 'number' ? tk.priceInr : 0
          setSettings({
            trainingKitPriceInr: price > 0 ? price : 0,
            gstPercent: typeof ch.gstPercent === 'number' ? ch.gstPercent : 18,
            coupons: Array.isArray(ch.coupons) ? ch.coupons : [],
          })
          if (tk && price > 0) {
            setKitMeta({
              name: (tk.name || 'Training kit').trim(),
              shortDescription: (tk.shortDescription || '').trim(),
              thumbnailUrl: (tk.thumbnailUrl || '').trim(),
            })
          } else {
            setKitMeta(null)
          }
        } else {
          return fetchTrainingCheckoutSettings().then((s) => {
            if (!cancelled) {
              setSettings(s)
              setKitMeta(null)
            }
          })
        }
      })
      .catch(() => {
        if (cancelled) return
        return fetchTrainingCheckoutSettings()
          .then((s) => {
            if (!cancelled) {
              setSettings(s)
              setKitMeta(null)
            }
          })
          .catch(() => {
            if (!cancelled) setSettings({ trainingKitPriceInr: 0, gstPercent: 18, coupons: [] })
          })
      })
      .finally(() => {
        if (!cancelled) setCheckoutLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [course?.id])

  useEffect(() => {
    if (step !== 3 || !course) return
    let cancelled = false
    paymentService
      .fetchLastBilling()
      .then((snap) => {
        if (cancelled || !snap) return
        const streetVal = typeof snap.street === 'string' ? snap.street : ''
        if (streetVal.trim()) setStreet(streetVal)
        const apt = typeof snap.apartment === 'string' ? snap.apartment : ''
        if (apt.trim()) setApartment(apt)
        const c = typeof snap.city === 'string' ? snap.city : ''
        if (c.trim()) setCity(c)
        const st = typeof snap.state === 'string' ? snap.state : ''
        if (st.trim()) setState(st)
        const pin = typeof snap.pincode === 'string' ? snap.pincode : ''
        if (pin.trim()) setPincode(pin)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [step, course?.id])

  // Reset wizard only when enrolling in a different course — NOT on every parent render or auth store tick.
  // (Depending on full `course`/`user`/unstable callbacks was resetting step mid-flow → 1↔2↔3 loops and gateway never opens.)
  useEffect(() => {
    if (!course?.id) return
    clearPayError()
    setFullName((user?.name || '').trim())
    setEmail((user?.email || '').trim())
    setMobile((user?.mobile || '').replace(/\D/g, '').slice(-10))
    setUniversity((user?.university || '').trim())
    setCollegeName((user?.collegeName || '').trim())
    setCollegeOther('')
    setCourseLevel((user?.course || '').trim())
    setBranchOrSubject((user?.stream || '').trim())
    setBranchOther('')
    setSemester((user?.semester || '1st').trim() || '1st')
    setRegistrationNumber((user?.collegeRegNo || '').trim())
    setCouponCode('')
    setCouponApplied('')
    setCouponError(null)
    setIncludeKit(false)
    setFormError(null)
    setStep(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only when course id changes; read latest user
  }, [course?.id, clearPayError])

  const handleDismiss = () => {
    abandonCheckout?.()
    onClose()
  }

  const collegeOptions = useMemo(() => {
    if (!university || university === OTHER_OPTION_VALUE) return []
    const raw = REGISTRATION_COLLEGES_BY_UNIVERSITY[university]
    if (!raw || !Array.isArray(raw)) return []
    return collegeOptionsFromList(raw)
  }, [university])

  const subjectOpts = useMemo(() => subjectOptionsForCourse(courseLevel), [courseLevel])

  const gstRate = (settings?.gstPercent ?? 18) / 100
  const kitGstRate = 0.12
  const kitPrice = settings?.trainingKitPriceInr ?? 0
  const coupons = settings?.coupons ?? []

  const courseGross = course?.price ?? 0
  const kitGross = includeKit ? kitPrice : 0
  const subtotalIncl = Math.round((courseGross + kitGross) * 100) / 100
  const couponCheck = applyCouponToCourseLine(courseGross, couponApplied, coupons)
  const afterCourseGross = couponCheck.gross
  const afterKitGross = kitGross
  const rawDiscount = Math.round((courseGross - afterCourseGross) * 100) / 100
  const totalGross = Math.round((afterCourseGross + afterKitGross) * 100) / 100

  const courseSplit = splitInrTaxInclusive(courseGross, gstRate)
  const afterCouponSplit = splitInrTaxInclusive(afterCourseGross, gstRate)
  const kitSplit = kitGross > 0 ? splitInrTaxInclusive(kitGross, kitGstRate) : { base: 0, gst: 0, total: 0, gstRate: kitGstRate }
  const afterKitSplit = afterKitGross > 0 ? splitInrTaxInclusive(afterKitGross, kitGstRate) : { base: 0, gst: 0, total: 0, gstRate: kitGstRate }

  const thumb = course?.featuredImageUrl ? absoluteApiUrl(course.featuredImageUrl) : ''

  if (!course) return null

  const validateStep1 = (): boolean => {
    const name = fullName.trim()
    if (name.length < 3 || !/^[a-zA-Z\s.]+$/.test(name)) {
      setFormError('Please enter your full name.')
      return false
    }
    if (!university) {
      setFormError('Please select your university.')
      return false
    }
    const col =
      collegeName === OTHER_OPTION_VALUE ? collegeOther.trim() : collegeName.trim() || (university === OTHER_OPTION_VALUE ? collegeOther.trim() : '')
    if (!col) {
      setFormError('Please select or specify your college name.')
      return false
    }
    if (!courseLevel) {
      setFormError('Please select your course.')
      return false
    }
    if (!semester) {
      setFormError('Please select your semester.')
      return false
    }
    const reg = registrationNumber.trim()
    if (reg.length < 5) {
      setFormError('Please enter your registration number.')
      return false
    }
    const mob = mobile.replace(/\D/g, '')
    if (mob.length !== 10) {
      setFormError('Please enter a valid 10-digit mobile number.')
      return false
    }
    if (!validEmail(email)) {
      setFormError('Please enter a valid email address.')
      return false
    }
    if (
      (courseLevel === 'B.Tech' || courseLevel === 'Diploma') &&
      branchOrSubject === OTHER_OPTION_VALUE &&
      !branchOther.trim()
    ) {
      setFormError('Please specify branch.')
      return false
    }
    if (
      ['B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA'].includes(courseLevel) &&
      branchOrSubject === OTHER_OPTION_VALUE &&
      !branchOther.trim()
    ) {
      setFormError('Please specify subject.')
      return false
    }
    setFormError(null)
    return true
  }

  const validateStep3 = (): boolean => {
    if (!street.trim()) {
      setFormError('Please enter street address.')
      return false
    }
    if (!city.trim()) {
      setFormError('Please enter city.')
      return false
    }
    if (!state) {
      setFormError('Please select state.')
      return false
    }
    const pin = pincode.replace(/\D/g, '')
    if (pin.length !== 6) {
      setFormError('Please enter a valid 6-digit PIN code.')
      return false
    }
    const mob = mobile.replace(/\D/g, '')
    if (mob.length !== 10) {
      setFormError('Please enter a valid 10-digit mobile number.')
      return false
    }
    if (!validEmail(email)) {
      setFormError('Please enter a valid email address.')
      return false
    }
    setFormError(null)
    return true
  }

  const buildEnrollmentSnapshot = (): Record<string, string | undefined> => {
    const col =
      collegeName === OTHER_OPTION_VALUE
        ? collegeOther.trim()
        : collegeName.trim() || (university === OTHER_OPTION_VALUE ? collegeOther.trim() : collegeName.trim())
    let br = branchOrSubject
    if (branchOrSubject === OTHER_OPTION_VALUE) br = branchOther.trim()
    return {
      fullName: fullName.trim(),
      university,
      collegeName: col,
      course: courseLevel,
      branchOrSubject: br,
      semester,
      registrationNumber: registrationNumber.trim(),
      mobile: mobile.replace(/\D/g, '').slice(-10),
      email: email.trim(),
    }
  }

  const buildBillingSnapshot = (): Record<string, string | undefined> => ({
    fullName: fullName.trim(),
    country,
    street: street.trim(),
    apartment: apartment.trim(),
    city: city.trim(),
    state,
    pincode: pincode.replace(/\D/g, ''),
    phone: mobile.replace(/\D/g, '').slice(-10),
    email: email.trim(),
  })

  const onApplyCoupon = () => {
    setCouponError(null)
    const r = applyCouponToCourseLine(course?.price ?? 0, couponCode, coupons)
    if (!r.ok) {
      setCouponError(r.message || 'Invalid or expired coupon code.')
      setCouponApplied('')
      return
    }
    setCouponApplied(couponCode.trim().toUpperCase())
    setCouponError(null)
  }

  const runPayment = async () => {
    if (!validateStep3()) return
    clearPayError()
    await startCheckout({
      courseId: course.id,
      courseTitle: course.title,
      price: course.price,
      prefill: {
        name: fullName.trim(),
        email: email.trim(),
        contact: mobile.replace(/\D/g, '').slice(-10),
      },
      couponCode: couponApplied || undefined,
      includeTrainingKit: includeKit && kitPrice > 0,
      enrollmentSnapshot: buildEnrollmentSnapshot(),
      billingSnapshot: buildBillingSnapshot(),
      onSuccess: onClose,
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" aria-hidden onClick={handleDismiss} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Step {step} of 3</p>
              <h2 className="text-lg font-bold text-brand-navy">
                {step === 1 ? 'Enrollment details' : step === 2 ? 'Order summary' : 'Billing & payment'}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {step === 1 ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email ID</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                    <input
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">University</label>
                  <select
                    value={university}
                    onChange={(e) => {
                      setUniversity(e.target.value)
                      setCollegeName('')
                      setCollegeOther('')
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  >
                    <option value="">Select university</option>
                    {REGISTRATION_UNIVERSITIES_LIST.map((u) => (
                      <option key={u.name} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">College Name</label>
                  {collegeOptions.length > 0 ? (
                    <select
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    >
                      <option value="">Select college</option>
                      {collegeOptions.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={collegeOther}
                      onChange={(e) => setCollegeOther(e.target.value)}
                      placeholder="College name"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    />
                  )}
                  {isOtherCollege(collegeName) || (university === OTHER_OPTION_VALUE && collegeOptions.length === 0) ? (
                    <input
                      value={collegeOther}
                      onChange={(e) => setCollegeOther(e.target.value)}
                      placeholder="Specify college"
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    />
                  ) : null}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                    <select
                      value={courseLevel}
                      onChange={(e) => {
                        setCourseLevel(e.target.value)
                        setBranchOrSubject('')
                        setBranchOther('')
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    >
                      <option value="">Select</option>
                      {STUDENT_COURSES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value={OTHER_OPTION_VALUE}>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch / Subject</label>
                    {courseLevel === 'B.Tech' || courseLevel === 'Diploma' ? (
                      <>
                        <select
                          value={branchOrSubject}
                          onChange={(e) => setBranchOrSubject(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                        >
                          <option value="">Select branch</option>
                          {BRANCHES_66.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                          <option value={OTHER_OPTION_VALUE}>Other</option>
                        </select>
                        {branchOrSubject === OTHER_OPTION_VALUE ? (
                          <input
                            value={branchOther}
                            onChange={(e) => setBranchOther(e.target.value)}
                            placeholder="Specify branch"
                            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                          />
                        ) : null}
                      </>
                    ) : ['B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA'].includes(courseLevel) ? (
                      <>
                        <select
                          value={branchOrSubject}
                          onChange={(e) => setBranchOrSubject(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                        >
                          <option value="">Select subject</option>
                          {subjectOpts.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                          <option value={OTHER_OPTION_VALUE}>Other</option>
                        </select>
                        {branchOrSubject === OTHER_OPTION_VALUE ? (
                          <input
                            value={branchOther}
                            onChange={(e) => setBranchOther(e.target.value)}
                            placeholder="Specify subject"
                            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                          />
                        ) : null}
                      </>
                    ) : courseLevel === OTHER_OPTION_VALUE ? (
                      <input
                        value={branchOther}
                        onChange={(e) => setBranchOther(e.target.value)}
                        placeholder="Course / branch or subject"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                      />
                    ) : !courseLevel ? (
                      <p className="text-sm text-gray-400 py-2">Select your course first</p>
                    ) : (
                      <p className="text-sm text-gray-400 py-2">No branch or subject required for this course type.</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
                      {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                    <input
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                {checkoutLoading ? <p className="text-xs text-gray-500">Loading checkout options…</p> : null}
                <div className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  {thumb ? (
                    <img src={thumb} alt="" className="h-20 w-28 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="h-20 w-28 shrink-0 rounded-md bg-gray-200" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 line-clamp-2">{course.title}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {course.universities} · {course.mode} · {course.duration}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm space-y-2">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal (course + kit, incl. GST)</span>
                    <span>{formatInr(subtotalIncl)}</span>
                  </div>
                  {couponApplied && rawDiscount > 0 ? (
                    <div className="flex justify-between text-emerald-800">
                      <span>Coupon discount ({couponApplied})</span>
                      <span>−{formatInr(rawDiscount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-gray-700 pt-1 border-t border-dashed border-gray-100">
                    <span>Net taxable value (excl. GST)</span>
                    <span>{formatInr(afterCouponSplit.base + afterKitSplit.base)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Total GST (course @ {settings?.gstPercent ?? 18}% + kit @ 12%)</span>
                    <span>{formatInr(afterCouponSplit.gst + afterKitSplit.gst)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
                    <span>Grand total (incl. GST)</span>
                    <span>{formatInr(totalGross)}</span>
                  </div>
                  <p className="text-xs text-gray-500 pt-1">
                    Course list {formatInr(courseGross)} (incl. GST): taxable {formatInr(courseSplit.base)}, GST{' '}
                    {formatInr(courseSplit.gst)}
                    {kitGross > 0 ? (
                      <span className="block mt-1">
                        Kit list {formatInr(kitGross)} (incl. GST): taxable {formatInr(kitSplit.base)}, GST{' '}
                        {formatInr(kitSplit.gst)} @ 12%
                      </span>
                    ) : null}
                    {couponApplied ? (
                      <span className="block mt-1 text-emerald-700">
                        Payable after coupon {formatInr(totalGross)} — matches the amount charged at checkout (server-priced).
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Coupon code"
                    className="flex-1 min-w-[8rem] rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={onApplyCoupon} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-200">
                    Apply
                  </button>
                </div>
                {couponError ? <p className="text-sm text-red-600">{couponError}</p> : null}
                {kitPrice > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">XpertIntern recommends</p>
                    <div className="flex gap-3">
                      {kitMeta?.thumbnailUrl ? (
                        <img
                          src={absoluteApiUrl(kitMeta.thumbnailUrl)}
                          alt=""
                          className="h-16 w-20 shrink-0 rounded object-cover bg-white"
                        />
                      ) : (
                        <div className="h-16 w-20 shrink-0 rounded bg-amber-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{kitMeta?.name || 'Training kit'}</p>
                        {kitMeta?.shortDescription ? (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-3">{kitMeta.shortDescription}</p>
                        ) : null}
                        <p className="text-sm font-bold text-brand-navy mt-2">
                          {formatInr(kitPrice)} <span className="text-xs font-normal text-gray-600">incl. GST (12%)</span>
                        </p>
                        <label className="mt-2 flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                          <input type="checkbox" checked={includeKit} onChange={(e) => setIncludeKit(e.target.checked)} />
                          Add to order
                        </label>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country / Region</label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
                    <option value="India">India</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street address</label>
                  <input value={street} onChange={(e) => setStreet(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apartment / suite (optional)</label>
                  <input value={apartment} onChange={(e) => setApartment(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Town / City</label>
                    <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <select value={state} onChange={(e) => setState(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
                      <option value="">Select state</option>
                      {INDIAN_STATES_UTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PIN code</label>
                    <input value={pincode} onChange={(e) => setPincode(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
                  </div>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                  <p className="font-semibold text-gray-900">Pay {formatInr(totalGross)}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Taxable {formatInr(afterCouponSplit.base + afterKitSplit.base)} + GST: course{' '}
                    {formatInr(afterCouponSplit.gst)} ({settings?.gstPercent ?? 18}%)
                    {afterKitGross > 0 ? (
                      <>, kit {formatInr(afterKitSplit.gst)} (12%)</>
                    ) : null}
                  </p>
                </div>
              </>
            ) : null}

            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            {payError ? <p className="text-sm text-red-600">{payError}</p> : null}

            <div className="flex flex-wrap gap-2 justify-between pt-2">
              {step > 1 ? (
                <button
                  type="button"
                  disabled={payBusy}
                  onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              ) : (
                <span />
              )}
              {step === 1 ? (
                <button
                  type="button"
                  onClick={() => validateStep1() && setStep(2)}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
                >
                  Proceed <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
              {step === 2 ? (
                <button
                  type="button"
                  disabled={payBusy}
                  onClick={() => {
                    setCouponError(null)
                    const typed = couponCode.trim()
                    if (typed && typed.toUpperCase() !== couponApplied) {
                      setCouponError('Click Apply next to the coupon box, or clear the field to continue.')
                      return
                    }
                    if (course.price <= 0) {
                      clearPayError()
                      void startCheckout({
                        courseId: course.id,
                        courseTitle: course.title,
                        price: 0,
                        enrollmentSnapshot: buildEnrollmentSnapshot(),
                        onSuccess: onClose,
                      })
                      return
                    }
                    setStep(3)
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
                >
                  {payBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {course.price <= 0 ? 'Enroll for free' : 'Proceed to checkout'}{' '}
                  {course.price > 0 ? <ArrowRight className="h-4 w-4" /> : null}
                </button>
              ) : null}
              {step === 3 ? (
                <button
                  type="button"
                  disabled={payBusy}
                  onClick={() => void runPayment()}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
                >
                  {payBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {course.price <= 0 ? 'Complete enrollment' : 'Make payment'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
