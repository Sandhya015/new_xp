import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Award, Ban, Download, Eye, FileDown, Loader2, RefreshCw, Send, Upload, X } from 'lucide-react'
import { adminService } from '@/services/adminService'

type CoursePick = { id: string; title: string }

type CertPreviewRow = {
  enrollmentId: string
  email: string
  name: string
  matched: boolean
  approveInSheet: boolean
  completionQuizPassed: boolean
  certificateIssued: boolean
}

type RegisterCertRow = {
  id: string
  certNo: string
  studentName: string
  studentEmail: string
  programName: string
  courseId: string
  issueDate: string
  completionDate: string
  university: string
  status: string
  source: string
}

/**
 * Admin — Certificate Generation. Part 5A §6. By Batch + By Excel upload, certificate register.
 */
export function CertificateUpload() {
  const [activeTab, setActiveTab] = useState<'batch' | 'excel' | 'register'>('batch')
  const [trainings, setTrainings] = useState<Array<{ id: string; title: string }>>([])
  const [certificates, setCertificates] = useState<RegisterCertRow[]>([])
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerSearch, setRegisterSearch] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerStatus, setRegisterStatus] = useState('')
  const [viewCertId, setViewCertId] = useState<string | null>(null)
  const [viewDetail, setViewDetail] = useState<Awaited<ReturnType<typeof adminService.getCertificateDetail>> | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [registerActionBusy, setRegisterActionBusy] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; certNo: string } | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [registerNotice, setRegisterNotice] = useState<string | null>(null)

  const [excelCourses, setExcelCourses] = useState<CoursePick[]>([])
  const [excelCourseId, setExcelCourseId] = useState('')
  /** Avoid one global busy flag — it put a spinner on Download while disabling Upload/Bulk, which looked like all three “fired”. */
  const [excelBusyAction, setExcelBusyAction] = useState<null | 'download' | 'parse' | 'bulk'>(null)
  const [excelMsg, setExcelMsg] = useState<string | null>(null)
  const [certPreview, setCertPreview] = useState<CertPreviewRow[] | null>(null)
  const [certSelected, setCertSelected] = useState<Record<string, boolean>>({})
  const excelFileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (activeTab === 'batch') {
      adminService.getCertificateTrainings().then((r) => setTrainings(r.items || [])).catch(() => setTrainings([]))
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'excel') {
      adminService
        .getCourses()
        .then((r) => {
          const raw = (r.items || []) as Array<{ id?: string; title?: string }>
          const opts = raw
            .map((x) => ({ id: String(x.id || ''), title: String(x.title || 'Untitled') }))
            .filter((x) => x.id)
          setExcelCourses(opts)
        })
        .catch(() => setExcelCourses([]))
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'register') setRegisterNotice(null)
  }, [activeTab, registerSearch, registerEmail, registerStatus])

  useEffect(() => {
    if (activeTab !== 'register') return
    setRegisterLoading(true)
    adminService
      .getCertificates({
        search: registerSearch.trim() || undefined,
        email: registerEmail.trim() || undefined,
        status: registerStatus || undefined,
      })
      .then((r) => setCertificates((r.items || []) as RegisterCertRow[]))
      .catch(() => setCertificates([]))
      .finally(() => setRegisterLoading(false))
  }, [activeTab, registerSearch, registerEmail, registerStatus])

  useEffect(() => {
    if (!viewCertId) {
      setViewDetail(null)
      return
    }
    setViewLoading(true)
    adminService
      .getCertificateDetail(viewCertId)
      .then(setViewDetail)
      .catch(() => setViewDetail(null))
      .finally(() => setViewLoading(false))
  }, [viewCertId])

  const openVerifyPublic = (certNo: string) => {
    const q = encodeURIComponent(certNo.trim())
    window.open(`${window.location.origin}/verify?cert=${q}`, '_blank', 'noopener,noreferrer')
  }

  const downloadCertPdf = async (id: string, certNo: string) => {
    setRegisterActionBusy(id)
    setRegisterNotice(null)
    try {
      const blob = await adminService.downloadAdminCertificatePdf(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `XpertIntern-${(certNo || 'certificate').replace(/[^\w-]+/g, '_')}.pdf`
      a.rel = 'noopener'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setRegisterNotice('Could not download the PDF.')
    } finally {
      setRegisterActionBusy(null)
    }
  }

  const submitRevoke = async () => {
    if (!revokeTarget) return
    const rid = revokeTarget.id
    const reason = revokeReason.trim()
    if (reason.length < 3) {
      setRegisterNotice('Enter a revoke reason (at least 3 characters).')
      return
    }
    setRegisterActionBusy(rid)
    setRegisterNotice(null)
    try {
      await adminService.revokeCertificate(rid, reason)
      setRevokeTarget(null)
      setRevokeReason('')
      setRegisterNotice('Certificate revoked.')
      setViewCertId(null)
      const refreshed = await adminService.getCertificates({
        search: registerSearch.trim() || undefined,
        email: registerEmail.trim() || undefined,
        status: registerStatus || undefined,
      })
      setCertificates((refreshed.items || []) as RegisterCertRow[])
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response
          ? String((e.response as { data?: { error?: string } }).data?.error ?? 'Revoke failed')
          : 'Revoke failed'
      setRegisterNotice(msg)
    } finally {
      setRegisterActionBusy(null)
    }
  }

  const downloadRoster = async () => {
    const cid = excelCourseId.trim()
    if (!cid) {
      setExcelMsg('Select a course first.')
      return
    }
    setExcelBusyAction('download')
    setExcelMsg(null)
    try {
      const blob = await adminService.downloadEnrollmentsCertificateSheet(cid)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `course_${cid}_enrollments.xlsx`
      a.rel = 'noopener'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExcelMsg('Download failed. Confirm openpyxl is installed on the API server.')
    } finally {
      setExcelBusyAction(null)
    }
  }

  const onExcelPicked = async (ev: ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    const cid = excelCourseId.trim()
    if (!f || !cid) {
      setExcelMsg('Select a course, then upload the workbook.')
      return
    }
    setExcelBusyAction('parse')
    setExcelMsg(null)
    try {
      const data = await adminService.parseCertificateSheet(cid, f)
      const items = (data.items || []) as CertPreviewRow[]
      setCertPreview(items)
      const sel: Record<string, boolean> = {}
      for (const it of items) {
        const id = String(it.enrollmentId || '').trim()
        if (it.matched && it.approveInSheet && !it.certificateIssued && id) {
          sel[id] = true
        }
      }
      setCertSelected(sel)
      setExcelMsg(`Parsed ${data.count ?? items.length} row(s).`)
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response
          ? String((e.response as { data?: { error?: string } }).data?.error ?? 'Parse failed')
          : 'Parse failed'
      setExcelMsg(msg)
      setCertPreview(null)
    } finally {
      setExcelBusyAction(null)
    }
  }

  const bulkIssue = async () => {
    const cid = excelCourseId.trim()
    const enrollmentIds = Object.entries(certSelected)
      .filter(([, v]) => v)
      .map(([k]) => k.trim())
      .filter(Boolean)
    if (!cid) {
      setExcelMsg('Select a course.')
      return
    }
    if (enrollmentIds.length === 0) {
      setExcelMsg('Select at least one row to issue.')
      return
    }
    setExcelBusyAction('bulk')
    setExcelMsg(null)
    try {
      const res = await adminService.bulkEmailCertificates(cid, enrollmentIds)
      const errPart = res.errors?.length ? ` Errors: ${res.errors.length}.` : ''
      const parts: string[] = []
      if ((res.newlyIssued ?? 0) > 0) parts.push(`${res.newlyIssued} newly issued`)
      if ((res.resent ?? 0) > 0) parts.push(`${res.resent} re-sent (same certificate ID)`)
      const breakdown = parts.length ? ` ${parts.join(', ')}.` : ''
      setExcelMsg(`Certificate email(s) completed: ${res.issuedOrEmailed}.${breakdown}${errPart}`)
      setCertPreview(null)
      setCertSelected({})
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response
          ? String((e.response as { data?: { error?: string } }).data?.error ?? 'Bulk send failed')
          : 'Bulk send failed'
      setExcelMsg(msg)
    } finally {
      setExcelBusyAction(null)
    }
  }

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-lg font-semibold text-brand-navy">Certificate Generation</h2>

      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('batch')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'batch' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Generate by Batch
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'excel' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Generate by Excel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'register' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Certificate Register
        </button>
      </div>

      {activeTab === 'batch' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <h3 className="font-semibold text-brand-navy">Generate by Batch</h3>
          <p className="text-sm text-slate-gray">Select Training Program → Batch → Students → Certificate details → Generate. Unique Certificate ID + QR per certificate.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Training Program *</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                <option value="">Select program</option>
                {trainings.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Batch *</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                <option value="">Select batch</option>
              </select>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Student Selection (checkbox / Select All)</h4>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left"><input type="checkbox" className="rounded text-brand-accent" title="Select All" /></th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Reg. No.</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">University</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-gray">Select program and batch to load students.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Certificate Type</label>
              <input type="text" placeholder="e.g. Training Completion" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Issue Date</label>
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Duration</label>
              <input type="text" placeholder="e.g. 4 Weeks" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mode</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option>Online</option><option>Offline</option><option>Hybrid</option></select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Template</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Default</option></select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Signatory</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Default</option></select>
            </div>
          </div>
          <button type="button" className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
            Generate Certificates
          </button>
        </div>
      )}

      {activeTab === 'excel' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h3 className="font-semibold text-brand-navy">Generate by Excel</h3>
          <div className="max-w-xl">
            <label className="block text-sm font-medium text-gray-700">Course</label>
            <select
              value={excelCourseId}
              onChange={(e) => {
                setExcelCourseId(e.target.value)
                setCertPreview(null)
                setCertSelected({})
                setExcelMsg(null)
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="">Select course…</option>
              {excelCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3 items-center" role="toolbar" aria-label="Excel certificate actions">
            <button
              type="button"
              disabled={excelBusyAction !== null || !excelCourseId}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void downloadRoster()
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {excelBusyAction === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download roster
            </button>
            <button
              type="button"
              disabled={excelBusyAction !== null || !excelCourseId}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                excelFileRef.current?.click()
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {excelBusyAction === 'parse' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload sheet
            </button>
            <button
              type="button"
              disabled={excelBusyAction !== null || !certPreview?.length}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void bulkIssue()
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
            >
              {excelBusyAction === 'bulk' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Generate &amp; email
            </button>
          </div>
          {/* Keep file input out of the flex row so no engine paints an invisible hit-target over the Download button. */}
          <input
            ref={excelFileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => void onExcelPicked(e)}
          />
          {excelMsg ? <p className="text-sm text-slate-700">{excelMsg}</p> : null}
          {certPreview && certPreview.length > 0 ? (
            <p className="text-xs text-slate-600">
              Tick <strong>Issue</strong> for each learner to include in Generate &amp; email. Rows need <strong>Matched: Yes</strong>{' '}
              (enrollment found for this course). Rows that already have a certificate are skipped automatically.
            </p>
          ) : null}
          {certPreview && certPreview.length > 0 ? (
            <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-gray-200 isolate relative z-0">
              <table className="min-w-full text-sm relative z-0">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Issue</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Matched</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Approve (sheet)</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Completion quiz</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Cert exists</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white relative z-0">
                  {certPreview.map((row, rowIndex) => {
                    const eid = String(row.enrollmentId || '').trim()
                    const canSelect = row.matched && !!eid
                    return (
                      <tr key={`${eid || 'no-id'}-${rowIndex}-${row.email || ''}`}>
                        <td className="px-3 py-2 align-middle relative z-[1]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-brand-accent focus:ring-brand-accent cursor-pointer"
                            disabled={!canSelect}
                            checked={!!certSelected[eid]}
                            onChange={(e) => {
                              e.stopPropagation()
                              const checked = e.target.checked
                              setCertSelected((prev) => ({ ...prev, [eid]: checked }))
                            }}
                            onClick={(e) => e.stopPropagation()}
                            title={
                              !row.matched
                                ? 'Enrollment not found for this course — fix sheet or course selection.'
                                : !eid
                                  ? 'Missing enrollment id.'
                                  : row.certificateIssued
                                    ? 'Already has a certificate — will be skipped when sending.'
                                    : 'Include in Generate & email'
                            }
                            aria-label={`Select ${row.name || row.email || 'row'} for certificate email`}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">{row.matched ? 'Yes' : 'No'}</td>
                        <td className="px-3 py-2 align-middle break-all max-w-[14rem]">{row.email || '—'}</td>
                        <td className="px-3 py-2 align-middle break-words max-w-[12rem]">{row.name?.trim() || '—'}</td>
                        <td className="px-3 py-2 align-middle">{row.approveInSheet ? 'Y' : '—'}</td>
                        <td className="px-3 py-2 align-middle">{row.completionQuizPassed ? 'Y' : '—'}</td>
                        <td className="px-3 py-2 align-middle">{row.certificateIssued ? 'Y' : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}

      {activeTab === 'register' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-semibold text-brand-navy">Certificate Register</h3>
            <p className="mt-1 text-sm text-slate-gray">
              Learners who have been issued a certificate appear here. Filter by student email or search by certificate ID /
              name. Use the icons to view details, download PDF, or revoke (reason required).
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search (ID / name / email)</label>
              <input
                type="search"
                value={registerSearch}
                onChange={(e) => setRegisterSearch(e.target.value)}
                placeholder="Certificate ID, student name…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Student email</label>
              <input
                type="search"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                placeholder="Filter by email…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={registerStatus}
                onChange={(e) => setRegisterStatus(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 min-w-[9rem]"
              >
                <option value="">All</option>
                <option value="valid">Valid</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
          </div>
          {registerNotice ? (
            <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{registerNotice}</p>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Certificate ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Student</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Program</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Issued</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">University</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {registerLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-gray">
                      <Loader2 className="inline h-5 w-5 animate-spin" /> Loading…
                    </td>
                  </tr>
                ) : certificates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-gray">
                      <Award className="mx-auto h-10 w-10 text-gray-300" />
                      <p className="mt-2">No issued certificates match these filters.</p>
                    </td>
                  </tr>
                ) : (
                  certificates.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs text-brand-navy">{c.certNo}</td>
                      <td className="px-3 py-2">{c.studentName || '—'}</td>
                      <td className="px-3 py-2 break-all max-w-[12rem] text-gray-700">{c.studentEmail || '—'}</td>
                      <td className="px-3 py-2 max-w-[14rem]">{c.programName || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">{c.issueDate || '—'}</td>
                      <td className="px-3 py-2 max-w-[10rem]">{c.university || '—'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            c.status === 'revoked'
                              ? 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800'
                              : 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800'
                          }
                        >
                          {c.status === 'revoked' ? 'Revoked' : 'Valid'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="View details"
                            onClick={() => setViewCertId(c.id)}
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-brand-navy"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Download PDF"
                            disabled={registerActionBusy === c.id}
                            onClick={() => void downloadCertPdf(c.id, c.certNo)}
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-brand-navy disabled:opacity-40"
                          >
                            {registerActionBusy === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileDown className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Revoke certificate"
                            disabled={c.status === 'revoked'}
                            onClick={() => {
                              setRevokeReason('')
                              setRevokeTarget({ id: c.id, certNo: c.certNo })
                            }}
                            className="rounded-lg p-2 text-gray-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Re-issue (coming soon)"
                            onClick={() =>
                              setRegisterNotice('Re-issue from this screen is not available yet. Contact engineering if you need a new certificate issued.')
                            }
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-gray">Showing up to 500 most recent records. Email filter matches stored email or linked learner account.</p>

          {viewCertId ? (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) setViewCertId(null)
              }}
            >
              <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setViewCertId(null)}
                  className="absolute right-3 top-3 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="p-6 pr-14 space-y-4">
                  <h4 className="text-lg font-semibold text-brand-navy">Certificate details</h4>
                  {viewLoading ? (
                    <p className="text-sm text-slate-gray flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </p>
                  ) : viewDetail ? (
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">Certificate ID</dt>
                        <dd className="font-mono font-medium text-right">{viewDetail.certNo}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">Status</dt>
                        <dd className="font-medium text-right">{viewDetail.status}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">Student</dt>
                        <dd className="text-right">{viewDetail.studentName}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">Email</dt>
                        <dd className="text-right break-all">{viewDetail.studentEmail || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">Mobile</dt>
                        <dd className="text-right">{viewDetail.studentMobile || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">Program</dt>
                        <dd className="text-right">{viewDetail.programName}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">Course</dt>
                        <dd className="text-right">{viewDetail.courseTitle || viewDetail.courseId || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">University</dt>
                        <dd className="text-right">{viewDetail.university || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">Issue date</dt>
                        <dd className="text-right">{viewDetail.issueDate}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">Completion</dt>
                        <dd className="text-right">{viewDetail.completionDate || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                        <dt className="text-slate-gray">Source</dt>
                        <dd className="text-right text-xs">{viewDetail.source || '—'}</dd>
                      </div>
                      {viewDetail.status === 'revoked' ? (
                        <>
                          <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                            <dt className="text-slate-gray">Revoked at</dt>
                            <dd className="text-right text-xs">{viewDetail.revokedAt || '—'}</dd>
                          </div>
                          <div className="pt-1">
                            <dt className="text-slate-gray">Revoke reason</dt>
                            <dd className="mt-1 text-gray-800">{viewDetail.revokeReason || '—'}</dd>
                          </div>
                        </>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="text-sm text-red-600">Could not load this certificate.</p>
                  )}
                  {viewDetail ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => openVerifyPublic(viewDetail.certNo)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        Open public verify
                      </button>
                      <button
                        type="button"
                        disabled={registerActionBusy === viewDetail.id}
                        onClick={() => void downloadCertPdf(viewDetail.id, viewDetail.certNo)}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                      >
                        {registerActionBusy === viewDetail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                        Download PDF
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {revokeTarget ? (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
              <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-brand-navy">Revoke certificate</h4>
                <p className="mt-2 text-sm text-slate-gray">
                  Certificate <span className="font-mono font-medium">{revokeTarget.certNo}</span> will be marked revoked. This
                  cannot be undone from the student app without a new issue.
                </p>
                <label className="mt-4 block text-sm font-medium text-gray-700">Reason (required)</label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. Issued in error, learner withdrew…"
                />
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRevokeTarget(null)
                      setRevokeReason('')
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={registerActionBusy === revokeTarget.id}
                    onClick={() => void submitRevoke()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {registerActionBusy === revokeTarget.id ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null}
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
