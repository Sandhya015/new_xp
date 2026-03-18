/**
 * Student Dashboard — My Profile View & Edit (SD-WF-17), Change Password (SD-WF-18). API wired.
 */
import { useState, useEffect } from 'react'
import { authService } from '@/services/authService'

function profileCompletionPercent(profile: Record<string, unknown> | null): number {
  if (!profile) return 0
  const fields = ['name', 'email', 'university', 'course', 'semester', 'collegeName']
  const filled = fields.filter((f) => profile[f] && String(profile[f]).trim()).length
  return Math.round((filled / 6) * 100)
}

export function Profile() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    authService
      .me()
      .then((data: Record<string, unknown>) => {
        setProfile(data)
        setForm({
          name: String(data?.name ?? ''),
          email: String(data?.email ?? ''),
          mobile: String(data?.mobile ?? ''),
          university: String(data?.university ?? ''),
          collegeName: String(data?.collegeName ?? ''),
          semester: String(data?.semester ?? ''),
          course: String(data?.course ?? ''),
          stream: String(data?.stream ?? ''),
        })
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [])

  const complete = profileCompletionPercent(profile)

  const handleSaveSection = (section: string) => {
    const payload: Record<string, string | null> = {}
    if (section === 'personal') {
      payload.name = form.name || null
      payload.mobile = form.mobile || null
    }
    if (section === 'academic') {
      payload.university = form.university || null
      payload.collegeName = form.collegeName || null
      payload.semester = form.semester || null
      payload.course = form.course || null
      payload.stream = form.stream || null
    }
    authService
      .updateProfile(payload)
      .then((data: Record<string, unknown>) => {
        setProfile(data)
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
      .changePassword(pwForm.current, pwForm.new)
      .then(() => {
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
      <p className="mt-1 text-sm text-slate-gray">Manage your account and academic details.</p>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-700">Profile completion</p>
          <span className="text-sm font-semibold text-brand-navy">{complete}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-brand-accent transition-all"
            style={{ width: `${complete}%` }}
          />
        </div>
        {complete < 80 && (
          <p className="mt-2 text-xs text-amber-700">Complete the sections below to unlock all features.</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-brand-navy">Personal Information</h3>
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
            <label className="block text-xs font-medium text-gray-600">Full Name</label>
            {editing === 'personal' ? (
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-900">{profile.name != null ? String(profile.name) : '—'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Email</label>
            <p className="mt-1 text-sm text-gray-900">{profile.email != null ? String(profile.email) : '—'}</p>
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
              <p className="mt-1 text-sm text-gray-900">{profile.mobile != null ? String(profile.mobile) : '—'}</p>
            )}
          </div>
        </div>
        {saveSuccess && editing === null && (
          <p className="mt-3 text-sm text-emerald-600">Profile updated successfully.</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-brand-navy">Academic Information</h3>
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
          {['university', 'collegeName', 'course', 'stream', 'semester'].map((key) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600">
                {key === 'collegeName' ? 'College' : key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
              {editing === 'academic' ? (
                <input
                  type="text"
                  value={form[key] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">{profile[key] != null ? String(profile[key]) : '—'}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-brand-navy">Change Password (SD-WF-18)</h3>
        <p className="mt-1 text-sm text-slate-gray">Update your password. You will stay logged in on this device.</p>
        <div className="mt-4 max-w-sm space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Current Password</label>
            <input
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">New Password</label>
            <input
              type="password"
              value={pwForm.new}
              onChange={(e) => setPwForm((f) => ({ ...f, new: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Confirm New Password</label>
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
            {pwLoading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
