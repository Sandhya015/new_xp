import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { adminService, type StudentListParams, type StudentRow } from '@/services/adminService'
import { showAppToast } from '@/components/AppToastHost'

function statusBadgeClass(status: string) {
  const s = (status || '').toLowerCase()
  if (s.includes('suspend')) return 'bg-amber-100 text-amber-800'
  if (s.includes('delet')) return 'bg-red-100 text-red-800'
  return 'bg-emerald-100 text-emerald-800'
}

export function StudentList() {
  const [items, setItems] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [accountStatus, setAccountStatus] = useState('all')
  const [enrollmentStatus, setEnrollmentStatus] = useState('')
  const [university, setUniversity] = useState('')
  const [collegeName, setCollegeName] = useState('')
  const [course, setCourse] = useState('')
  const [branch, setBranch] = useState('')
  const [semester, setSemester] = useState('')
  const [registeredFrom, setRegisteredFrom] = useState('')
  const [registeredTo, setRegisteredTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [total, setTotal] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)

  const buildParams = (): StudentListParams => ({
    search: search || undefined,
    page,
    limit,
    university: university || undefined,
    collegeName: collegeName || undefined,
    course: course || undefined,
    branch: branch || undefined,
    semester: semester || undefined,
    enrollmentStatus: enrollmentStatus || undefined,
    accountStatus: accountStatus === 'all' ? undefined : accountStatus,
    registeredFrom: registeredFrom || undefined,
    registeredTo: registeredTo || undefined,
  })

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    page,
    limit,
    university,
    collegeName,
    course,
    branch,
    semester,
    enrollmentStatus,
    accountStatus,
    registeredFrom,
    registeredTo,
  ])

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
    setUniversity('')
    setCollegeName('')
    setCourse('')
    setBranch('')
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
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Export failed'
      showAppToast(typeof msg === 'string' ? msg : 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-brand-navy">Student Management</h2>
        <div className="relative">
          <button
            type="button"
            disabled={exporting}
            onClick={() => setExportOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export'}
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => downloadExport('csv')}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadExport('xlsx')}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Export XLSX
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={accountStatus}
          onChange={(e) => {
            setAccountStatus(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
        <select
          value={enrollmentStatus}
          onChange={(e) => {
            setEnrollmentStatus(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
        >
          <option value="">Enrollment: Any</option>
          <option value="enrolled">Enrolled</option>
          <option value="not_enrolled">Not enrolled</option>
        </select>
        <input
          type="text"
          placeholder="University"
          value={university}
          onChange={(e) => {
            setUniversity(e.target.value)
            setPage(1)
          }}
          className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="College"
          value={collegeName}
          onChange={(e) => {
            setCollegeName(e.target.value)
            setPage(1)
          }}
          className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Course"
          value={course}
          onChange={(e) => {
            setCourse(e.target.value)
            setPage(1)
          }}
          className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Branch / stream"
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value)
            setPage(1)
          }}
          className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Semester"
          value={semester}
          onChange={(e) => {
            setSemester(e.target.value)
            setPage(1)
          }}
          className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={registeredFrom}
          onChange={(e) => {
            setRegisteredFrom(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          title="Registered from"
        />
        <input
          type="date"
          value={registeredTo}
          onChange={(e) => {
            setRegisteredTo(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          title="Registered to"
        />
        <div className="flex gap-2 min-w-[240px] flex-1">
          <input
            type="search"
            placeholder="Search name, email, mobile, ID…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={applySearch}
            className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy/90"
          >
            Search
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Mobile</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">University / Course</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Registered</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-gray">
                    No students match these filters.
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-brand-navy">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.mobile}</td>
                  <td className="px-4 py-3 text-sm text-slate-gray">
                    {row.university}
                    {row.course ? ` · ${row.course}` : ''}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-gray">{row.registered}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/students/${row.id}`}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 inline-flex"
                      title="View profile"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-slate-gray">
          <span>
            {total.toLocaleString()} student{total === 1 ? '' : 's'} · Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
