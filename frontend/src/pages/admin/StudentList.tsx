import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { adminService, type StudentListParams, type StudentRow } from '@/services/adminService'
import { showAppToast } from '@/components/AppToastHost'
import { SearchableMultiSelect, SearchableSingleSelect } from '@/components/admin/SearchableSelect'
import {
  useAcademicMasters,
  collegeOptionsForUniversities,
  branchSubjectOptions,
  semesterLabelsForCourse,
  isBranchCourse,
} from '@/hooks/useAcademicMasters'

function statusBadgeClass(status: string) {
  const s = (status || '').toLowerCase()
  if (s.includes('suspend')) return 'bg-amber-100 text-amber-800'
  if (s.includes('delet')) return 'bg-red-100 text-red-800'
  return 'bg-emerald-100 text-emerald-800'
}

function splitCsv(raw: string | null): string[] {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function StudentList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { universities, courses } = useAcademicMasters()

  const [items, setItems] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [accountStatus, setAccountStatus] = useState(searchParams.get('accountStatus') || 'all')
  const [enrollmentStatus, setEnrollmentStatus] = useState(searchParams.get('enrollmentStatus') || '')
  const [universitiesSel, setUniversitiesSel] = useState<string[]>(() => splitCsv(searchParams.get('university')))
  const [collegesSel, setCollegesSel] = useState<string[]>(() => splitCsv(searchParams.get('collegeName')))
  const [coursesSel, setCoursesSel] = useState<string[]>(() => splitCsv(searchParams.get('course')))
  const [branchesSel, setBranchesSel] = useState<string[]>(() => splitCsv(searchParams.get('branch')))
  const [semester, setSemester] = useState(searchParams.get('semester') || '')
  const [registeredFrom, setRegisteredFrom] = useState(searchParams.get('registeredFrom') || '')
  const [registeredTo, setRegisteredTo] = useState(searchParams.get('registeredTo') || '')
  const [page, setPage] = useState(Number(searchParams.get('page') || 1) || 1)
  const [limit] = useState(50)
  const [total, setTotal] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)

  const collegeOptions = useMemo(
    () => collegeOptionsForUniversities(universitiesSel).map((c) => ({ value: c, label: c })),
    [universitiesSel],
  )

  const primaryCourse = coursesSel[0] || ''
  const branchLabel = primaryCourse
    ? isBranchCourse(primaryCourse)
      ? 'Branch'
      : 'Subject'
    : 'Branch / Subject'
  const branchOpts = useMemo(() => {
    if (coursesSel.length === 1) return branchSubjectOptions(coursesSel[0])
    // When multi courses selected, union branch lists for tech courses only if all tech
    const sets = coursesSel.flatMap((c) => branchSubjectOptions(c))
    const seen = new Set<string>()
    return sets.filter((o) => {
      if (seen.has(o.value)) return false
      seen.add(o.value)
      return true
    })
  }, [coursesSel])
  const semesterOpts = useMemo(
    () => semesterLabelsForCourse(primaryCourse).map((s) => ({ value: s, label: s })),
    [primaryCourse],
  )

  const buildParams = useCallback((): StudentListParams => {
    return {
      search: search || undefined,
      page,
      limit,
      university: universitiesSel.length ? universitiesSel.join(',') : undefined,
      collegeName: collegesSel.length ? collegesSel.join(',') : undefined,
      course: coursesSel.length ? coursesSel.join(',') : undefined,
      branch: branchesSel.length ? branchesSel.join(',') : undefined,
      semester: semester || undefined,
      enrollmentStatus: enrollmentStatus || undefined,
      accountStatus: accountStatus === 'all' ? undefined : accountStatus,
      registeredFrom: registeredFrom || undefined,
      registeredTo: registeredTo || undefined,
    }
  }, [
    search,
    page,
    limit,
    universitiesSel,
    collegesSel,
    coursesSel,
    branchesSel,
    semester,
    enrollmentStatus,
    accountStatus,
    registeredFrom,
    registeredTo,
  ])

  // Persist filters to URL
  useEffect(() => {
    const next = new URLSearchParams()
    if (search) next.set('search', search)
    if (accountStatus && accountStatus !== 'all') next.set('accountStatus', accountStatus)
    if (enrollmentStatus) next.set('enrollmentStatus', enrollmentStatus)
    if (universitiesSel.length) next.set('university', universitiesSel.join(','))
    if (collegesSel.length) next.set('collegeName', collegesSel.join(','))
    if (coursesSel.length) next.set('course', coursesSel.join(','))
    if (branchesSel.length) next.set('branch', branchesSel.join(','))
    if (semester) next.set('semester', semester)
    if (registeredFrom) next.set('registeredFrom', registeredFrom)
    if (registeredTo) next.set('registeredTo', registeredTo)
    if (page > 1) next.set('page', String(page))
    setSearchParams(next, { replace: true })
  }, [
    search,
    accountStatus,
    enrollmentStatus,
    universitiesSel,
    collegesSel,
    coursesSel,
    branchesSel,
    semester,
    registeredFrom,
    registeredTo,
    page,
    setSearchParams,
  ])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    adminService
      .getStudents(buildParams())
      .then((res) => {
        if (cancelled) return
        setItems(res.items || [])
        setTotal(res.total ?? 0)
      })
      .catch(() => {
        if (!cancelled) {
          setItems([])
          setTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [buildParams])

  // Reset dependent filters
  useEffect(() => {
    setCollegesSel((prev) => prev.filter((c) => collegeOptions.some((o) => o.value === c)))
  }, [collegeOptions])

  useEffect(() => {
    setBranchesSel((prev) => prev.filter((b) => branchOpts.some((o) => o.value === b)))
    if (semester && !semesterOpts.some((o) => o.value === semester)) setSemester('')
  }, [branchOpts, semesterOpts, semester])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const applySearch = () => {
    setPage(1)
    setSearch(searchInput.trim())
  }

  const resetFilters = () => {
    setSearch('')
    setSearchInput('')
    setAccountStatus('all')
    setEnrollmentStatus('')
    setUniversitiesSel([])
    setCollegesSel([])
    setCoursesSel([])
    setBranchesSel([])
    setSemester('')
    setRegisteredFrom('')
    setRegisteredTo('')
    setPage(1)
  }

  const downloadExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true)
    setExportOpen(false)
    try {
      const blob = await adminService.exportStudents({ ...buildParams(), format, page: undefined, limit: undefined })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `students-export.${format === 'xlsx' ? 'xlsx' : 'csv'}`
      a.click()
      URL.revokeObjectURL(url)
      showAppToast(`Exported ${format.toUpperCase()}`)
    } catch {
      showAppToast('Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Student Management</h2>
          <p className="text-sm text-slate-gray">
            {loading ? 'Loading…' : `${total.toLocaleString()} student${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            disabled={exporting}
            onClick={() => setExportOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          {exportOpen && (
            <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => downloadExport('csv')}>
                CSV
              </button>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => downloadExport('xlsx')}>
                Excel (.xlsx)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-[200px] flex-1 gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            placeholder="Search name, email, mobile, ID…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="button" onClick={applySearch} className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white">
            Search
          </button>
        </div>
        <SearchableMultiSelect
          label="University"
          options={universities.map((u) => ({ value: u.value, label: u.label }))}
          values={universitiesSel}
          onChange={(v) => {
            setUniversitiesSel(v)
            setPage(1)
          }}
        />
        <SearchableMultiSelect
          label="College"
          options={collegeOptions}
          values={collegesSel}
          onChange={(v) => {
            setCollegesSel(v)
            setPage(1)
          }}
        />
        <SearchableMultiSelect
          label="Course"
          options={courses.map((c) => ({ value: c, label: c }))}
          values={coursesSel}
          onChange={(v) => {
            setCoursesSel(v)
            setBranchesSel([])
            setSemester('')
            setPage(1)
          }}
        />
        <SearchableMultiSelect
          label={branchLabel}
          options={branchOpts}
          values={branchesSel}
          onChange={(v) => {
            setBranchesSel(v)
            setPage(1)
          }}
          disabled={!coursesSel.length}
        />
        <SearchableSingleSelect
          label="Semester"
          options={semesterOpts}
          value={semester}
          onChange={(v) => {
            setSemester(v)
            setPage(1)
          }}
          emptyLabel="All"
        />
        <label className="text-sm">
          <span className="block text-[11px] font-medium text-gray-600 mb-0.5">Account</span>
          <select
            value={accountStatus}
            onChange={(e) => {
              setAccountStatus(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[11px] font-medium text-gray-600 mb-0.5">Enrollment</span>
          <select
            value={enrollmentStatus}
            onChange={(e) => {
              setEnrollmentStatus(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="">Any</option>
            <option value="enrolled">Enrolled</option>
            <option value="not_enrolled">Not enrolled</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[11px] font-medium text-gray-600 mb-0.5">From</span>
          <input type="date" value={registeredFrom} onChange={(e) => { setRegisteredFrom(e.target.value); setPage(1) }} className="rounded-lg border border-gray-300 px-2 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="block text-[11px] font-medium text-gray-600 mb-0.5">To</span>
          <input type="date" value={registeredTo} onChange={(e) => { setRegisteredTo(e.target.value); setPage(1) }} className="rounded-lg border border-gray-300 px-2 py-2 text-sm" />
        </label>
        <button type="button" onClick={resetFilters} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          Clear filters
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-gray">
          No results for this filter combination.{' '}
          <button type="button" className="text-brand-accent underline" onClick={resetFilters}>
            Clear filters
          </button>
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">University</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Course</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Registered</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.university || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.course || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.registered || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/students/${row.id}`} className="inline-flex items-center gap-1 rounded p-1.5 text-gray-600 hover:bg-gray-100" title="View">
                      <Eye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-slate-gray">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
