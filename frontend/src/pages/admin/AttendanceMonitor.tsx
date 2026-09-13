import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, X } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { attendanceService, type AttendanceConfig, type AttendanceStudentRow } from '@/services/attendanceService'

function CourseConfigBanner({ courseTitle, config }: { courseTitle: string; config: AttendanceConfig | null }) {
  if (!config) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No attendance configuration saved for <strong>{courseTitle}</strong>. Set it under Attendance → Configuration.
      </div>
    )
  }
  const required =
    config.durationUnit === 'weeks'
      ? `${config.durationWeeks} weeks · ${config.dailyHours}h/day`
      : `${config.totalHours} hours · ${config.dailyHours}h/day`
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
      <span className="font-semibold">{courseTitle}</span> — {required}
      {(config.universityDateRanges || []).length > 0 ? (
        <span className="text-emerald-800">
          {' '}
          · {(config.universityDateRanges || []).length} university date range(s) configured
        </span>
      ) : null}
    </div>
  )
}

export function AttendanceMonitor() {
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([])
  const [courseId, setCourseId] = useState('')
  const [courseConfig, setCourseConfig] = useState<AttendanceConfig | null>(null)
  const [students, setStudents] = useState<AttendanceStudentRow[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('present')
  const [detailUser, setDetailUser] = useState<AttendanceStudentRow | null>(null)
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPercent, setHistoryPercent] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const courseTitle = useMemo(
    () => courses.find((c) => c.id === courseId)?.title || 'Selected course',
    [courses, courseId],
  )

  useEffect(() => {
    adminService
      .getCourses()
      .then((r) => {
        const items = (r.items || []) as Array<{ id?: string; _id?: string; title?: string }>
        setCourses(items.map((c) => ({ id: String(c.id || c._id || ''), title: c.title || 'Untitled' })))
      })
      .catch(() => setCourses([]))
  }, [])

  const load = useCallback(() => {
    if (!courseId) return
    setLoading(true)
    setDetailUser(null)
    attendanceService
      .listStudents(courseId)
      .then((r) => {
        setStudents(r.students)
        setCourseConfig(r.config)
      })
      .catch(() => {
        setStudents([])
        setCourseConfig(null)
      })
      .finally(() => setLoading(false))
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  const bulkMark = async () => {
    if (!courseId || selected.length === 0 || !dateFrom || !dateTo) {
      setMessage('Select students and a date range.')
      return
    }
    try {
      await attendanceService.bulkMark({ courseId, userIds: selected, dateFrom, dateTo, status })
      setMessage('Attendance marked.')
      load()
    } catch {
      setMessage('Bulk mark failed.')
    }
  }

  const viewDetails = async (student: AttendanceStudentRow) => {
    setDetailUser(student)
    setHistory([])
    setHistoryPercent(null)
    setHistoryLoading(true)
    try {
      const r = await attendanceService.studentHistory(courseId, student.userId)
      setHistory(r.history)
      setHistoryPercent(r.percent)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const closeModal = () => {
    setDetailUser(null)
    setHistory([])
    setHistoryPercent(null)
  }

  return (
    <div className="max-w-6xl space-y-4">
      <Link to="/admin/attendance" className="inline-flex items-center gap-1 text-sm text-slate-gray hover:text-brand-navy">
        <ArrowLeft className="h-4 w-4" /> Attendance Hub
      </Link>
      <h1 className="text-xl font-bold text-brand-navy">Attendance Monitor</h1>

      <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
        <option value="">Select course</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      {courseId ? (
        <>
          <CourseConfigBanner courseTitle={courseTitle} config={courseConfig} />

          <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-3">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded border px-2 py-1 text-sm" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded border px-2 py-1 text-sm" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-2 py-1 text-sm">
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="partial">Partial</option>
            </select>
            <button type="button" onClick={bulkMark} className="rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-white">
              Bulk mark selected
            </button>
            {message ? <span className="text-sm text-slate-gray">{message}</span> : null}
          </div>

          {loading ? (
            <p className="inline-flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : (
            <div className="overflow-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Select</th>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">University</th>
                    <th className="px-3 py-2">Attendance %</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((s) => (
                    <tr key={s.userId}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(s.userId)}
                          onChange={() =>
                            setSelected((prev) =>
                              prev.includes(s.userId) ? prev.filter((x) => x !== s.userId) : [...prev, s.userId],
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-slate-gray">{s.email}</div>
                      </td>
                      <td className="px-3 py-2">{s.university || '—'}</td>
                      <td className="px-3 py-2">{s.attendancePercent != null ? `${s.attendancePercent}%` : '—'}</td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => viewDetails(s)} className="text-brand-accent hover:underline">
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {detailUser ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="attendance-history-title"
          onClick={closeModal}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 id="attendance-history-title" className="text-lg font-semibold text-brand-navy">
                  Attendance history
                </h2>
                <p className="mt-0.5 text-sm text-slate-gray">{detailUser.name}</p>
                {historyPercent != null ? (
                  <p className="mt-1 text-sm font-medium text-emerald-700">Overall: {historyPercent}%</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-gray hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {historyLoading ? (
                <p className="inline-flex items-center gap-2 text-sm text-slate-gray">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                </p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-gray">No attendance records yet for this student.</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {history.map((h, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="font-medium text-gray-900">{String(h.date || h.sessionDate || '—')}</span>
                      <span className="text-slate-gray">
                        {String(h.timeIn || '—')} – {String(h.timeOut || '—')} · {String(h.hoursCompleted ?? h.hours ?? '—')}h
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-gray-100 px-5 py-3 text-right">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
