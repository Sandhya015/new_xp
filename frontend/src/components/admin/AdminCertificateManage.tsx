import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Pencil, Trash2, Upload, RefreshCw, AlertCircle } from 'lucide-react'
import { adminService, type AdminCertificateFormPayload } from '@/services/adminService'
import { BulkCertificateWizard } from '@/components/admin/BulkCertificateWizard'

const emptyForm = (): AdminCertificateFormPayload => ({
  certNo: '',
  studentName: '',
  collegeName: '',
  course: '',
  branch: '',
  semester: '',
  registrationNo: '',
  domain: '',
  mode: 'Online',
  internshipStartDate: '',
  internshipEndDate: '',
  marks: '',
  attendance: '',
  session: '',
  duration: '',
  performanceRating: 'Good',
  autoGenerateCertNo: false,
})

function pdfLabel(c: {
  pdfStatus?: string
  hasUploadedPdf?: boolean
  pdfError?: string
}) {
  const s = (c.pdfStatus || '').toLowerCase()
  if (s === 'pending') return { text: 'Pending PDF', className: 'text-amber-700' }
  if (s === 'failed') return { text: 'Failed', className: 'text-red-600', title: c.pdfError || 'PDF generation failed' }
  if (s === 'uploaded' || c.hasUploadedPdf) return { text: 'Uploaded', className: 'text-emerald-700' }
  if (s === 'generated') return { text: 'Generated', className: 'text-emerald-700' }
  return { text: c.hasUploadedPdf ? 'Uploaded' : 'Generated', className: 'text-gray-700' }
}

export function AdminCertificateManage() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof adminService.getCertificates>>['items']>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AdminCertificateFormPayload>(emptyForm())
  const [editMeta, setEditMeta] = useState<{ bulkUploadedAt?: string; source?: string }>({})
  const pdfRef = useRef<HTMLInputElement>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const [progress, setProgress] = useState<{
    id: string
    createdCount: number
    pdfDone: number
    pdfFailed: number
    status: string
    fileName: string
  } | null>(null)

  const reload = () => {
    setLoading(true)
    adminService
      .getCertificates({ search: search.trim() || undefined })
      .then((r) => setItems(r.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [search])

  useEffect(() => {
    let cancelled = false
    const tick = () => {
      adminService
        .getActiveBulkCertificateJob()
        .then((r) => {
          if (cancelled) return
          setProgress(r.job)
          if (r.job && r.job.status === 'in_progress') reload()
        })
        .catch(() => {
          if (!cancelled) setProgress(null)
        })
    }
    tick()
    const id = window.setInterval(tick, 4000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setEditMeta({})
    setModalOpen(true)
    setNotice(null)
  }

  const openEdit = async (id: string) => {
    setBusy(id)
    try {
      const d = await adminService.getCertificateDetail(id)
      setEditingId(id)
      setEditMeta({
        bulkUploadedAt: (d as { bulkUploadedAt?: string }).bulkUploadedAt,
        source: d.source,
      })
      setForm({
        certNo: d.certNo,
        studentName: d.studentName,
        collegeName: d.collegeName || d.university || '',
        course: d.course || d.programName || '',
        branch: d.branch || '',
        semester: d.semester || '',
        registrationNo: d.registrationNo || '',
        domain: d.domain || d.programName || '',
        mode: d.mode || 'Online',
        internshipStartDate: d.internshipStartDate || '',
        internshipEndDate: d.internshipEndDate || d.completionDate || '',
        marks: d.marks || '',
        attendance: d.attendance || '',
        session: d.session || '',
        duration: d.duration || '',
        performanceRating: d.performanceRating || 'Good',
        autoGenerateCertNo: false,
      })
      setModalOpen(true)
    } catch {
      setNotice('Could not load certificate for editing.')
    } finally {
      setBusy(null)
    }
  }

  const saveForm = async () => {
    if (!form.studentName.trim()) {
      setNotice('Student name is required.')
      return
    }
    if (!editingId && !form.certNo.trim() && !form.autoGenerateCertNo) {
      setNotice('Enter a certificate number or enable auto-generate.')
      return
    }
    setBusy('save')
    setNotice(null)
    try {
      if (editingId) {
        await adminService.updateCertificate(editingId, form)
        setNotice('Certificate updated.')
      } else {
        await adminService.createCertificate(form)
        setNotice('Certificate created.')
      }
      setModalOpen(false)
      reload()
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Save failed')
          : 'Save failed'
      setNotice(msg)
    } finally {
      setBusy(null)
    }
  }

  const deleteCert = async (id: string, certNo: string) => {
    if (!window.confirm(`Delete certificate ${certNo}? This cannot be undone.`)) return
    setBusy(id)
    try {
      await adminService.deleteCertificate(id)
      setNotice('Certificate deleted.')
      reload()
    } catch {
      setNotice('Delete failed.')
    } finally {
      setBusy(null)
    }
  }

  const retryPdf = async (id: string) => {
    setBusy(id)
    try {
      await adminService.retryCertificatePdf(id)
      setNotice('PDF regenerated.')
      reload()
    } catch {
      setNotice('PDF retry failed.')
    } finally {
      setBusy(null)
    }
  }

  const onPdfPicked = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    const id = uploadTargetId
    if (!f || !id) return
    setBusy(id)
    try {
      await adminService.uploadCertificatePdf(id, f)
      setNotice('PDF uploaded.')
      reload()
    } catch {
      setNotice('PDF upload failed.')
    } finally {
      setBusy(null)
      setUploadTargetId(null)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-brand-navy">Internship Certificate Management</h3>
          <p className="text-sm text-slate-gray">Add, edit, upload PDF, and delete internship certificates for public verification.</p>
          <Link to="/admin/certificates/bulk-history" className="mt-1 inline-block text-xs font-medium text-brand-accent hover:underline">
            View bulk upload history
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent hover:bg-brand-accent/5"
          >
            <Plus className="h-4 w-4" /> Bulk Add Certificates
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" /> Add Certificate
          </button>
        </div>
      </div>

      {progress && progress.status === 'in_progress' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Generating certificates: {progress.pdfDone} of {progress.createdCount} done
          {progress.pdfFailed ? ` · ${progress.pdfFailed} failed` : ''}
          {progress.fileName ? ` · ${progress.fileName}` : ''}…
        </div>
      ) : null}

      <input
        type="search"
        placeholder="Search by certificate no, name, email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />

      {notice ? <p className="text-sm text-gray-700">{notice}</p> : null}

      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void onPdfPicked(e)} />

      {loading ? (
        <p className="text-sm text-slate-gray flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-gray">No certificates found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Cert No</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Domain</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">PDF</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => {
                const pdf = pdfLabel(c)
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-mono text-xs">{c.certNo}</td>
                    <td className="px-3 py-2">{c.studentName}</td>
                    <td className="px-3 py-2">{c.domain || c.programName}</td>
                    <td className="px-3 py-2 capitalize">{c.status}</td>
                    <td className={`px-3 py-2 ${pdf.className}`}>
                      <span className="inline-flex items-center gap-1" title={pdf.title}>
                        {pdf.text}
                        {(c.pdfStatus || '').toLowerCase() === 'failed' ? <AlertCircle className="h-3.5 w-3.5" /> : null}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {(c.pdfStatus || '').toLowerCase() === 'failed' ? (
                          <button
                            type="button"
                            title="Retry PDF"
                            disabled={busy === c.id}
                            onClick={() => void retryPdf(c.id)}
                            className="rounded p-1.5 text-amber-700 hover:bg-amber-50"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="Edit"
                          disabled={busy === c.id}
                          onClick={() => void openEdit(c.id)}
                          className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Upload PDF"
                          disabled={busy === c.id}
                          onClick={() => {
                            setUploadTargetId(c.id)
                            pdfRef.current?.click()
                          }}
                          className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                        >
                          <Upload className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          disabled={busy === c.id}
                          onClick={() => void deleteCert(c.id, c.certNo)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <BulkCertificateWizard
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={() => {
          reload()
        }}
      />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-brand-navy">{editingId ? 'Edit Certificate' : 'Add Certificate'}</h4>
            {editMeta.bulkUploadedAt ? (
              <p className="mt-1 text-xs text-slate-gray">Bulk-uploaded on {editMeta.bulkUploadedAt}</p>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {!editingId && (
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.autoGenerateCertNo}
                    onChange={(e) => setForm((f) => ({ ...f, autoGenerateCertNo: e.target.checked }))}
                  />
                  Auto-generate certificate number (XP/{new Date().getFullYear()}/INT/…)
                </label>
              )}
              <Field label="Certificate Number *" value={form.certNo} onChange={(v) => setForm((f) => ({ ...f, certNo: v }))} disabled={form.autoGenerateCertNo && !editingId} />
              <Field label="Student Name *" value={form.studentName} onChange={(v) => setForm((f) => ({ ...f, studentName: v }))} />
              <Field label="College Name" value={form.collegeName} onChange={(v) => setForm((f) => ({ ...f, collegeName: v }))} />
              <Field label="Course" value={form.course} onChange={(v) => setForm((f) => ({ ...f, course: v }))} />
              <Field label="Branch" value={form.branch} onChange={(v) => setForm((f) => ({ ...f, branch: v }))} />
              <Field label="Semester" value={form.semester} onChange={(v) => setForm((f) => ({ ...f, semester: v }))} />
              <Field label="Registration No" value={form.registrationNo} onChange={(v) => setForm((f) => ({ ...f, registrationNo: v }))} />
              <Field label="Session" value={form.session} onChange={(v) => setForm((f) => ({ ...f, session: v }))} placeholder="e.g. 2023 - 2027" />
              <Field label="Domain" value={form.domain} onChange={(v) => setForm((f) => ({ ...f, domain: v }))} />
              <Field label="Duration" value={form.duration} onChange={(v) => setForm((f) => ({ ...f, duration: v }))} placeholder="e.g. 6 Weeks" />
              <div>
                <label className="block text-xs font-medium text-gray-600">Mode</label>
                <select
                  value={form.mode}
                  onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option>Online</option>
                  <option>Offline</option>
                  <option>Hybrid</option>
                </select>
              </div>
              <Field label="Start Date" type="date" value={form.internshipStartDate} onChange={(v) => setForm((f) => ({ ...f, internshipStartDate: v }))} />
              <Field label="End Date" type="date" value={form.internshipEndDate} onChange={(v) => setForm((f) => ({ ...f, internshipEndDate: v }))} />
              <Field label="Marks" value={form.marks} onChange={(v) => setForm((f) => ({ ...f, marks: v }))} />
              <Field label="Attendance" value={form.attendance} onChange={(v) => setForm((f) => ({ ...f, attendance: v }))} placeholder="e.g. 95%" />
              <Field label="Performance Rating" value={form.performanceRating} onChange={(v) => setForm((f) => ({ ...f, performanceRating: v }))} placeholder="Good" />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy === 'save'}
                onClick={() => void saveForm()}
                className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === 'save' ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
      />
    </div>
  )
}
