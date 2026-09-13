import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { attendanceService, type AttendanceConfig } from '@/services/attendanceService'

const DEFAULT_CONFIG: Partial<AttendanceConfig> = {
  durationUnit: 'hours',
  totalHours: 120,
  dailyHours: 4,
  durationWeeks: 0,
  universityDateRanges: [],
}

function ConfigSummary({
  courseTitle,
  config,
  saved,
}: {
  courseTitle: string
  config: Partial<AttendanceConfig>
  saved: boolean
}) {
  const requiredLabel =
    config.durationUnit === 'weeks'
      ? `${config.durationWeeks ?? 0} weeks (${config.dailyHours ?? 4}h/day)`
      : `${config.totalHours ?? 0} total hours (${config.dailyHours ?? 4}h/day)`

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-start gap-2">
        {saved ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : null}
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-brand-navy">
            {saved ? 'Saved configuration' : 'No saved configuration yet'} — {courseTitle}
          </h2>
          {saved ? (
            <>
              <p className="mt-1 text-sm text-slate-gray">For this course, this is the current attendance configuration.</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-gray">Duration</dt>
                  <dd className="font-medium text-gray-900">{requiredLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-gray">Duration unit</dt>
                  <dd className="font-medium capitalize text-gray-900">{config.durationUnit || 'hours'}</dd>
                </div>
                {config.updatedAt ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-gray">Last updated</dt>
                    <dd className="font-medium text-gray-900">{new Date(config.updatedAt).toLocaleString()}</dd>
                  </div>
                ) : null}
              </dl>
              {(config.universityDateRanges || []).length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-gray">University date ranges</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(config.universityDateRanges || []).map((r, i) => (
                      <li key={i} className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                        <span className="font-medium">{r.university || 'All universities'}</span>
                        <span className="text-slate-gray">
                          {' '}
                          · {r.validFrom?.slice(0, 10) || '—'} to {r.validTo?.slice(0, 10) || '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-gray">No university date restrictions configured.</p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-gray">
              Select values below and save to create attendance rules for this course.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function AttendanceConfig() {
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([])
  const [courseId, setCourseId] = useState('')
  const [config, setConfig] = useState<Partial<AttendanceConfig>>(DEFAULT_CONFIG)
  const [savedConfig, setSavedConfig] = useState<Partial<AttendanceConfig> | null>(null)
  const [hasSavedConfig, setHasSavedConfig] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const courseTitle = useMemo(
    () => courses.find((c) => c.id === courseId)?.title || 'Selected course',
    [courses, courseId],
  )

  const loadConfig = useCallback(async (id: string) => {
    setLoading(true)
    setMessage(null)
    try {
      const c = await attendanceService.getConfig(id)
      if (c) {
        setConfig(c)
        setSavedConfig(c)
        setHasSavedConfig(true)
      } else {
        setConfig(DEFAULT_CONFIG)
        setSavedConfig(null)
        setHasSavedConfig(false)
      }
    } catch {
      setConfig(DEFAULT_CONFIG)
      setSavedConfig(null)
      setHasSavedConfig(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    adminService
      .getCourses()
      .then((r) => {
        const items = (r.items || []) as Array<{ id?: string; _id?: string; title?: string }>
        setCourses(items.map((c) => ({ id: String(c.id || c._id || ''), title: c.title || 'Untitled' })))
      })
      .catch(() => setCourses([]))
  }, [])

  useEffect(() => {
    if (!courseId) {
      setSavedConfig(null)
      setHasSavedConfig(false)
      setConfig(DEFAULT_CONFIG)
      return
    }
    loadConfig(courseId)
  }, [courseId, loadConfig])

  const addRange = () => {
    setConfig((c) => ({
      ...c,
      universityDateRanges: [...(c.universityDateRanges || []), { university: '', validFrom: '', validTo: '' }],
    }))
  }

  const updateRange = (idx: number, field: string, value: string) => {
    setConfig((c) => {
      const ranges = [...(c.universityDateRanges || [])]
      ranges[idx] = { ...ranges[idx], [field]: value }
      return { ...c, universityDateRanges: ranges }
    })
  }

  const removeRange = (idx: number) => {
    setConfig((c) => ({
      ...c,
      universityDateRanges: (c.universityDateRanges || []).filter((_, i) => i !== idx),
    }))
  }

  const save = async () => {
    if (!courseId) return
    setSaving(true)
    setMessage(null)
    try {
      const updated = await attendanceService.saveConfig(courseId, config)
      setConfig(updated)
      setSavedConfig(updated)
      setHasSavedConfig(true)
      setMessage(`Configuration saved for ${courseTitle}.`)
    } catch {
      setMessage('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Link to="/admin/attendance" className="inline-flex items-center gap-1 text-sm text-slate-gray hover:text-brand-navy">
        <ArrowLeft className="h-4 w-4" /> Attendance Hub
      </Link>
      <h1 className="text-xl font-bold text-brand-navy">Attendance Configuration</h1>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Course</span>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">Select course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>

      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-slate-gray">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…
        </p>
      ) : courseId ? (
        <>
          <ConfigSummary courseTitle={courseTitle} config={savedConfig || config} saved={hasSavedConfig} />

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-semibold text-brand-navy">Edit configuration</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Duration unit</span>
                <select
                  value={config.durationUnit || 'hours'}
                  onChange={(e) => setConfig((c) => ({ ...c, durationUnit: e.target.value as 'hours' | 'weeks' }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="hours">Hours</option>
                  <option value="weeks">Weeks</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Daily hours</span>
                <input
                  type="number"
                  value={config.dailyHours ?? 4}
                  onChange={(e) => setConfig((c) => ({ ...c, dailyHours: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              {config.durationUnit === 'weeks' ? (
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Duration (weeks)</span>
                  <input
                    type="number"
                    value={config.durationWeeks ?? 0}
                    onChange={(e) => setConfig((c) => ({ ...c, durationWeeks: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : (
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Total hours required</span>
                  <input
                    type="number"
                    value={config.totalHours ?? 0}
                    onChange={(e) => setConfig((c) => ({ ...c, totalHours: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-brand-navy">University date ranges</h3>
                <button type="button" onClick={addRange} className="inline-flex items-center gap-1 text-sm text-brand-accent">
                  <Plus className="h-4 w-4" /> Add range
                </button>
              </div>
              {(config.universityDateRanges || []).map((r, idx) => (
                <div key={idx} className="mb-2 grid gap-2 rounded-lg border border-gray-100 p-3 sm:grid-cols-4">
                  <input
                    placeholder="University"
                    value={r.university}
                    onChange={(e) => updateRange(idx, 'university', e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm sm:col-span-2"
                  />
                  <input
                    type="date"
                    value={r.validFrom?.slice(0, 10) || ''}
                    onChange={(e) => updateRange(idx, 'validFrom', e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={r.validTo?.slice(0, 10) || ''}
                      onChange={(e) => updateRange(idx, 'validTo', e.target.value)}
                      className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <button type="button" onClick={() => removeRange(idx)} className="text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save configuration'}
            </button>
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
