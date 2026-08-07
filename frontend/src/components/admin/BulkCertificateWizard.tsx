import { useMemo, useRef, useState } from 'react'
import { Loader2, Upload, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { adminService, type AdminCertificateFormPayload } from '@/services/adminService'

type PreviewRow = {
  row: number
  status: 'valid' | 'error'
  errorReason: string
  errors: string[]
  studentName: string
  domain: string
  certNo: string
  payload: (AdminCertificateFormPayload & { studentEmail?: string; autoGenerateCertNo?: boolean }) | null
  raw: Record<string, string> | null
}

type Props = {
  open: boolean
  onClose: () => void
  onDone: () => void
}

const STEPS = ['Template', 'Upload', 'Preview', 'Confirm'] as const

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function BulkCertificateWizard({ open, onClose, onDone }: Props) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<{
    total: number
    validCount: number
    errorCount: number
    rows: PreviewRow[]
  } | null>(null)
  const [filter, setFilter] = useState<'all' | 'valid' | 'error'>('all')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredRows = useMemo(() => {
    if (!preview) return []
    if (filter === 'valid') return preview.rows.filter((r) => r.status === 'valid')
    if (filter === 'error') return preview.rows.filter((r) => r.status === 'error')
    return preview.rows
  }, [preview, filter])

  if (!open) return null

  const closeWithConfirm = () => {
    if (fileName || preview) {
      if (!window.confirm('Cancel bulk upload? Uploaded file data in this wizard will be lost.')) return
    }
    resetAndClose()
  }

  const resetAndClose = () => {
    setStep(0)
    setBusy(false)
    setError(null)
    setFileName('')
    setPreview(null)
    setFilter('all')
    setSuccessMsg(null)
    onClose()
  }

  const downloadTemplate = async (format: 'xlsx' | 'csv') => {
    setBusy(true)
    setError(null)
    try {
      const blob = await adminService.downloadBulkCertificateTemplate(format)
      downloadBlob(blob, `xpertintern_bulk_certificates_template.${format}`)
    } catch {
      setError('Could not download template.')
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File | null) => {
    if (!file) return
    const lower = file.name.toLowerCase()
    if (!(lower.endsWith('.xlsx') || lower.endsWith('.csv') || lower.endsWith('.xls'))) {
      setError('Accepted formats: .xlsx, .xls, or .csv.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is larger than 10 MB.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await adminService.previewBulkCertificates(file)
      setFileName(data.fileName)
      setPreview({
        total: data.total,
        validCount: data.validCount,
        errorCount: data.errorCount,
        rows: data.rows as PreviewRow[],
      })
      setStep(2)
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Upload failed')
          : 'Upload failed'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const downloadErrors = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const blob = await adminService.downloadBulkCertificateErrors(preview.rows)
      downloadBlob(blob, 'certificate_upload_errors.xlsx')
    } catch {
      setError('Could not download errors file.')
    } finally {
      setBusy(false)
    }
  }

  const generate = async () => {
    if (!preview || preview.validCount < 1) return
    setBusy(true)
    setError(null)
    try {
      const valid = preview.rows.filter((r) => r.status === 'valid' && r.payload)
      const res = await adminService.generateBulkCertificates({
        fileName,
        totalRows: preview.total,
        errorRows: preview.errorCount,
        rows: valid.map((r) => ({ payload: r.payload! })),
      })
      setSuccessMsg(res.message)
      setStep(3)
      onDone()
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Generate failed')
          : 'Generate failed'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h4 className="text-lg font-semibold text-brand-navy">Bulk Add Certificates</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {STEPS.map((label, i) => (
              <span
                key={label}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  i === step ? 'bg-brand-accent text-white' : i < step ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {i + 1}. {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
            </p>
          ) : null}

          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-gray">
                Download the template, fill one row per student (same fields as Add Certificate), then continue to upload.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void downloadTemplate('xlsx')}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
                >
                  <Download className="h-4 w-4" /> Download Excel template
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void downloadTemplate('csv')}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium"
                >
                  <Download className="h-4 w-4" /> Download CSV template
                </button>
              </div>
              <ul className="list-disc pl-5 text-xs text-slate-gray space-y-1">
                <li>Leave Certificate Number blank to auto-generate (XP/YYYY/…).</li>
                <li>Dates must be DD-MM-YYYY. Mode: Online / Offline / Hybrid.</li>
                <li>Domain must match an existing training title.</li>
                <li>Optional column Student Email — used to email the PDF when ready.</li>
              </ul>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-gray">Upload your filled .xlsx or .csv (max 10 MB, 1000 rows).</p>
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  void onFile(e.dataTransfer.files?.[0] || null)
                }}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center hover:border-brand-accent"
              >
                {busy ? (
                  <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm font-medium text-brand-navy">Drag file here or click to browse</p>
                    <p className="text-xs text-slate-gray">.xlsx, .xls, .csv</p>
                  </>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  e.target.value = ''
                  void onFile(f)
                }}
              />
            </div>
          )}

          {step === 2 && preview && (
            <div className="space-y-3">
              <p className="text-sm text-gray-800">
                <strong>{preview.validCount}</strong> valid rows,{' '}
                <strong className="text-red-600">{preview.errorCount}</strong> rows with errors, total {preview.total}.
                {fileName ? <span className="text-slate-gray"> · {fileName}</span> : null}
              </p>
              {preview.validCount === 0 ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  No valid rows. Fix the file and upload again.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 text-xs">
                {(['all', 'valid', 'error'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-3 py-1 font-medium ${
                      filter === f ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {f === 'all' ? 'Show all' : f === 'valid' ? 'Show only valid' : 'Show only errors'}
                  </button>
                ))}
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-left">
                    <tr>
                      <th className="px-2 py-2">Row</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Domain</th>
                      <th className="px-2 py-2">Cert No</th>
                      <th className="px-2 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.map((r) => (
                      <tr key={r.row} className={r.status === 'valid' ? 'bg-emerald-50/60' : 'bg-red-50/70'}>
                        <td className="px-2 py-1.5">{r.row}</td>
                        <td className="px-2 py-1.5 font-medium capitalize">{r.status}</td>
                        <td className="px-2 py-1.5">{r.studentName}</td>
                        <td className="px-2 py-1.5">{r.domain}</td>
                        <td className="px-2 py-1.5 font-mono">{r.certNo}</td>
                        <td className="px-2 py-1.5 text-red-700">{r.errorReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && successMsg && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <p className="max-w-md text-sm text-gray-800">{successMsg}</p>
              <p className="text-xs text-slate-gray">PDFs generate in the background. Watch the progress banner on the list page.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-6 py-3">
          <button type="button" onClick={closeWithConfirm} className="rounded-lg border px-4 py-2 text-sm">
            {successMsg ? 'Close' : 'Cancel'}
          </button>
          <div className="flex flex-wrap gap-2">
            {step > 0 && step < 3 && !successMsg ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (step === 2) {
                    setPreview(null)
                    setFileName('')
                    setStep(1)
                  } else setStep((s) => Math.max(0, s - 1))
                }}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Back
              </button>
            ) : null}
            {step === 0 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Continue to upload
              </button>
            ) : null}
            {step === 2 && preview ? (
              <>
                {preview.errorCount > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void downloadErrors()}
                    className="rounded-lg border px-4 py-2 text-sm"
                  >
                    Download errors as Excel
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy || preview.validCount < 1}
                  onClick={() => void generate()}
                  className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? 'Queuing…' : 'Generate certificates'}
                </button>
              </>
            ) : null}
            {successMsg ? (
              <button
                type="button"
                onClick={resetAndClose}
                className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Done
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
