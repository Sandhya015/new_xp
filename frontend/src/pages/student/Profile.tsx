/**
 * Student Dashboard — My Profile (S-5): header, personal, academic, password; enrollment backfill.
 */
import { useState, useEffect } from 'react'
import { authService } from '@/services/authService'
import { enrollmentService } from '@/services/enrollmentService'
import { useAuthStore } from '@/store/authStore'
import { absoluteApiUrl } from '@/config/api'
import { INDIAN_STATES_UTS } from '@/constants/indianRegions'

const COMPLETION_FIELDS = [
  'name',
  'email',
  'mobile',
  'university',
  'collegeName',
  'course',
  'stream',
  'semester',
  'collegeRegNo',
  'profilePhotoUrl',
  'dateOfBirth',
  'gender',
  'addressLine1',
] as const

function profileCompletionPercent(profile: Record<string, unknown> | null): number {
  if (!profile) return 0
  const filled = COMPLETION_FIELDS.filter((f) => profile[f] && String(profile[f]).trim()).length
  return Math.round((filled / COMPLETION_FIELDS.length) * 100)
}

type FormState = {
  name: string
  email: string
  mobile: string
  university: string
  collegeName: string
  semester: string
  course: string
  stream: string
  collegeRegNo: string
  yearOfJoining: string
  dateOfBirth: string
  gender: string
  addressLine1: string
  addressApartment: string
  addressCity: string
  addressState: string
  addressPincode: string
  addressCountry: string
}

function emptyForm(): FormState {
  return {
    name: '',
    email: '',
    mobile: '',
    university: '',
    collegeName: '',
    semester: '',
    course: '',
    stream: '',
    collegeRegNo: '',
    yearOfJoining: '',
    dateOfBirth: '',
    gender: '',
    addressLine1: '',
    addressApartment: '',
    addressCity: '',
    addressState: '',
    addressPincode: '',
    addressCountry: 'India',
  }
}

function formFromProfile(data: Record<string, unknown>): FormState {
  return {
    name: String(data?.name ?? ''),
    email: String(data?.email ?? ''),
    mobile: String(data?.mobile ?? ''),
    university: String(data?.university ?? ''),
    collegeName: String(data?.collegeName ?? ''),
    semester: String(data?.semester ?? ''),
    course: String(data?.course ?? ''),
    stream: String(data?.stream ?? ''),
    collegeRegNo: String(data?.collegeRegNo ?? ''),
    yearOfJoining: String(data?.yearOfJoining ?? ''),
    dateOfBirth: String(data?.dateOfBirth ?? ''),
    gender: String(data?.gender ?? ''),
    addressLine1: String(data?.addressLine1 ?? ''),
    addressApartment: String(data?.addressApartment ?? ''),
    addressCity: String(data?.addressCity ?? ''),
    addressState: String(data?.addressState ?? ''),
    addressPincode: String(data?.addressPincode ?? ''),
    addressCountry: String(data?.addressCountry ?? 'India') || 'India',
  }
}

function mergeSnapshot(form: FormState, snap: Record<string, string> | null | undefined): FormState {
  if (!snap) return form
  const pick = (cur: string, v: string | undefined) => (cur.trim() ? cur : (v || '').trim())
  return {
    ...form,
    name: pick(form.name, snap.fullName),
    university: pick(form.university, snap.university),
    collegeName: pick(form.collegeName, snap.collegeName),
    course: pick(form.course, snap.course),
    stream: pick(form.stream, snap.branchOrSubject),
    semester: pick(form.semester, snap.semester),
    collegeRegNo: pick(form.collegeRegNo, snap.registrationNumber),
    mobile: pick(form.mobile, snap.mobile),
  }
}

export function Profile() {
  const setUserStore = useAuthStore((s) => s.setUser)
  const storeUser = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState('')
  const [backfillNote, setBackfillNote] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([authService.me(), enrollmentService.list().catch(() => ({ items: [] }))])
      .then(([data, enr]) => {
        if (cancelled) return
        const me = data as Record<string, unknown>
        setProfile(me)
        let next = formFromProfile(me)
        const items = (enr.items || []) as Array<{ enrollmentProfileSnapshot?: Record<string, string> | null }>
        let merged = false
        for (const row of items) {
          const snap = row.enrollmentProfileSnapshot
          if (snap && typeof snap === 'object') {
            const before = JSON.stringify(next)
            next = mergeSnapshot(next, snap)
            if (JSON.stringify(next) !== before) merged = true
          }
        }
        setForm(next)
        setBackfillNote(merged)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const complete = profileCompletionPercent(profile)
  const photoSrc =
    profile?.profilePhotoUrl != null && String(profile.profilePhotoUrl).trim()
      ? absoluteApiUrl(String(profile.profilePhotoUrl))
      : ''

  const syncStorePhoto = (data: Record<string, unknown>) => {
    const url = data.profilePhotoUrl != null ? String(data.profilePhotoUrl) : undefined
    if (storeUser && storeUser.id === String(data.id ?? storeUser.id)) {
      setUserStore({ ...storeUser, profilePhotoUrl: url?.trim() ? url : undefined })
    }
  }

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoErr('')
    setPhotoBusy(true)
    try {
      const data = (await authService.uploadProfilePhoto(file)) as Record<string, unknown>
      setProfile(data)
      setForm(formFromProfile(data))
      syncStorePhoto(data)
    } catch {
      setPhotoErr('Could not upload photo. Use JPEG or PNG under 2 MB.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const onRemovePhoto = async () => {
    setPhotoErr('')
    setPhotoBusy(true)
    try {
      const data = (await authService.updateProfile({ profilePhotoUrl: null })) as Record<string, unknown>
      setProfile(data)
      setForm(formFromProfile(data))
      syncStorePhoto(data)
    } catch {
      setPhotoErr('Could not remove photo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const handleSaveSection = (section: string) => {
    const payload: Record<string, string | null> = {}
    if (section === 'personal') {
      payload.name = form.name || null
      payload.mobile = form.mobile || null
      payload.dateOfBirth = form.dateOfBirth?.trim() ? form.dateOfBirth.trim() : null
      payload.gender = form.gender?.trim() ? form.gender.trim() : null
      payload.addressLine1 = form.addressLine1?.trim() ? form.addressLine1.trim() : null
      payload.addressApartment = form.addressApartment?.trim() ? form.addressApartment.trim() : null
      payload.addressCity = form.addressCity?.trim() ? form.addressCity.trim() : null
      payload.addressState = form.addressState?.trim() ? form.addressState.trim() : null
      payload.addressPincode = form.addressPincode?.trim() ? form.addressPincode.replace(/\D/g, '').slice(0, 6) : null
      payload.addressCountry = form.addressCountry?.trim() ? form.addressCountry.trim() : null
    }
    if (section === 'academic') {
      payload.university = form.university || null
      payload.collegeName = form.collegeName || null
      payload.semester = form.semester || null
      payload.course = form.course || null
      payload.stream = form.stream || null
      payload.collegeRegNo = form.collegeRegNo?.trim() ? form.collegeRegNo.trim() : null
      payload.yearOfJoining = form.yearOfJoining?.trim() ? form.yearOfJoining.trim() : null
    }
    authService
      .updateProfile(payload)
      .then((data: Record<string, unknown>) => {
        setProfile(data)
        setForm(formFromProfile(data))
        setEditing(null)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      })
      .catch(() => {})
  }

  const handleChangePassword = () => {
    if (pwForm.new !== pwForm.confirm) {
      setPwError('Passwords do not match.')
      return
    }
    if (pwForm.new.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    setPwError('')
    setPwLoading(true)
    authService
      .changePassword(pwForm.current, pwForm.new, pwForm.confirm)
      .then((res) => {
        if (res.token && res.user) {
          useAuthStore.getState().setSession(
            res.user as ReturnType<typeof useAuthStore.getState>['user'],
            res.token,
            res.expiresIn,
          )
        }
        setPwSuccess(true)
        setPwForm({ current: '', new: '', confirm: '' })
        setTimeout(() => setPwSuccess(false), 3000)
      })
      .catch((err: { response?: { data?: { error?: string } } }) => {
        setPwError(err?.response?.data?.error || 'Failed to update password.')
      })
      .finally(() => setPwLoading(false))
  }

  if (loading) {
    return (
      <div className="max-w-4xl">
        <p className="text-slate-gray">Loading profile...</p>
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="max-w-4xl">
        <p className="text-red-600">Failed to load profile.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="text-lg font-bold text-brand-navy">My Profile</h2>
      <p className="mt-1 text-sm text-slate-gray">Manage your account, contact details, and academic information.</p>

      {backfillNote ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          We prefilled some academic fields from your latest enrollment. Review and tap <strong>Save</strong> to store them
          on your profile.
        </p>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Profile overview</h3>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
            {photoSrc ? (
              <img src={photoSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-2 text-center text-xs text-gray-400">No photo</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-brand-navy">{profile.name != null ? String(profile.name) : '—'}</p>
            <p className="text-sm text-slate-gray">{profile.email != null ? String(profile.email) : '—'}</p>
            <div className="mt-3 max-w-md">
              <div className="flex justify-between text-xs font-medium text-gray-600">
                <span>Profile completion</span>
                <span>{complete}%</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${complete}%` }} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                className="max-w-xs text-xs text-gray-700 file:mr-2 file:rounded file:border file:border-gray-300 file:bg-white file:px-2 file:py-1"
                disabled={photoBusy}
                onChange={(e) => void onPickPhoto(e)}
              />
              {photoSrc ? (
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => void onRemovePhoto()}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
            {photoErr ? <p className="mt-2 text-xs text-red-600">{photoErr}</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-brand-navy">Personal information</h3>
          {editing !== 'personal' ? (
            <button
              type="button"
              onClick={() => setEditing('personal')}
              className="text-sm font-medium text-brand-accent hover:underline"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSaveSection('personal')}
                className="rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600">Full name</label>
            {editing === 'personal' ? (
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-900">{form.name || '—'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Email</label>
            <p className="mt-1 text-sm text-gray-900">{form.email || '—'}</p>
            <p className="text-xs text-slate-gray">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Mobile</label>
            {editing === 'personal' ? (
              <input
                type="text"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="10-digit mobile"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-900">{form.mobile || '—'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Date of birth</label>
            {editing === 'personal' ? (
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-900">{form.dateOfBirth || '—'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Gender</label>
            {editing === 'personal' ? (
              <select
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            ) : (
              <p className="mt-1 text-sm text-gray-900">{form.gender ? form.gender.charAt(0).toUpperCase() + form.gender.slice(1) : '—'}</p>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-600">Address</p>
          {editing === 'personal' ? (
            <>
              <input
                value={form.addressLine1}
                onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                placeholder="Street"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={form.addressApartment}
                onChange={(e) => setForm((f) => ({ ...f, addressApartment: e.target.value }))}
                placeholder="Apartment / unit (optional)"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={form.addressCity}
                  onChange={(e) => setForm((f) => ({ ...f, addressCity: e.target.value }))}
                  placeholder="City"
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <select
                  value={form.addressState}
                  onChange={(e) => setForm((f) => ({ ...f, addressState: e.target.value }))}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">State / UT</option>
                  {INDIAN_STATES_UTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  value={form.addressPincode}
                  onChange={(e) => setForm((f) => ({ ...f, addressPincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="PIN code"
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  value={form.addressCountry}
                  onChange={(e) => setForm((f) => ({ ...f, addressCountry: e.target.value }))}
                  placeholder="Country"
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-900 whitespace-pre-line">
              {[form.addressLine1, form.addressApartment, form.addressCity, form.addressState, form.addressPincode, form.addressCountry]
                .filter(Boolean)
                .join(', ') || '—'}
            </p>
          )}
        </div>
        {saveSuccess && editing === null && <p className="mt-3 text-sm text-emerald-600">Profile updated successfully.</p>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-brand-navy">Academic information</h3>
          {editing !== 'academic' ? (
            <button
              type="button"
              onClick={() => setEditing('academic')}
              className="text-sm font-medium text-brand-accent hover:underline"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSaveSection('academic')}
                className="rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['university', 'University'],
              ['collegeName', 'College'],
              ['course', 'Course'],
              ['stream', 'Branch / subject'],
              ['semester', 'Semester'],
              ['collegeRegNo', 'Registration number'],
              ['yearOfJoining', 'Year of joining'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600">{label}</label>
              {editing === 'academic' ? (
                <input
                  type="text"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">{form[key] || '—'}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-brand-navy">Change password</h3>
        <p className="mt-1 text-sm text-slate-gray">Update your password. You stay signed in on this device.</p>
        <div className="mt-4 max-w-sm space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Current password</label>
            <input
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">New password</label>
            <input
              type="password"
              value={pwForm.new}
              onChange={(e) => setPwForm((f) => ({ ...f, new: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Confirm new password</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-emerald-600">Password updated successfully.</p>}
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={pwLoading || !pwForm.current || !pwForm.new || !pwForm.confirm}
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {pwLoading ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </div>
    </div>
  )
}
