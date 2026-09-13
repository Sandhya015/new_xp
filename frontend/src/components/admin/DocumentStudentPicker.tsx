import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { ScrollSelect } from '@/components/admin/ScrollSelect'
import { documentsService, type EnrolledStudentRow } from '@/services/documentsService'
import { adminService } from '@/services/adminService'

type Props = {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  courseId: string
  onCourseChange: (id: string) => void
}

export function DocumentStudentPicker({ selectedIds, onChange, courseId, onCourseChange }: Props) {
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([])
  const [students, setStudents] = useState<EnrolledStudentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [university, setUniversity] = useState('')
  const [college, setCollege] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    adminService
      .getCourses()
      .then((r) => {
        const items = (r.items || []) as Array<{ id?: string; _id?: string; title?: string }>
        setCourses(items.map((c) => ({ id: String(c.id || c._id || ''), title: c.title || 'Untitled' })))
      })
      .catch(() => setCourses([]))
  }, [])

  const loadStudents = useCallback(() => {
    if (!courseId) {
      setStudents([])
      return
    }
    setLoading(true)
    documentsService
      .enrolledStudents(courseId, { university: university || undefined, college: college || undefined, q: q || undefined })
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false))
  }, [courseId, university, college, q])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const universities = useMemo(() => {
    const set = new Set<string>()
    students.forEach((s) => {
      const u = s.profile.university?.trim()
      if (u) set.add(u)
    })
    return Array.from(set).sort()
  }, [students])

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  const selectAll = () => onChange(students.map((s) => s.userId))

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ScrollSelect
          label="Course / Batch"
          value={courseId}
          onChange={onCourseChange}
          placeholder="Select course"
          emptyLabel=""
          options={courses.map((c) => ({ value: c.id, label: c.title }))}
        />
        <ScrollSelect
          label="University"
          value={university}
          onChange={setUniversity}
          emptyLabel="All"
          options={universities.map((u) => ({ value: u, label: u }))}
        />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">College</span>
          <input
            value={college}
            onChange={(e) => setCollege(e.target.value)}
            placeholder="Filter college"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Search</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, roll no"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-gray">
          {selectedIds.length} selected · {students.length} students
        </p>
        <button type="button" onClick={selectAll} className="text-sm font-medium text-brand-accent hover:underline">
          Select all
        </button>
      </div>

      {loading ? (
        <p className="inline-flex items-center gap-2 py-6 text-sm text-slate-gray">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
        </p>
      ) : !courseId ? (
        <p className="py-6 text-sm text-slate-gray">Select a course to load enrolled students.</p>
      ) : students.length === 0 ? (
        <p className="py-6 text-sm text-slate-gray">No enrolled students match your filters.</p>
      ) : (
        <div className="scroll-light max-h-80 overflow-auto rounded-lg border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Select</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">University</th>
                <th className="px-3 py-2">Roll No</th>
                <th className="px-3 py-2">Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.userId} className="hover:bg-gray-50/80">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedIds.includes(s.userId)} onChange={() => toggle(s.userId)} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{s.profile.name}</div>
                    <div className="text-xs text-slate-gray">{s.profile.email}</div>
                  </td>
                  <td className="px-3 py-2">{s.profile.university || '—'}</td>
                  <td className="px-3 py-2">{s.profile.registrationNo || '—'}</td>
                  <td className="px-3 py-2">{s.mode || s.profile.mode || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
