import { useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { crmService, type CrmImportRecord } from '@/services/crmService'

const QUICK_EXPORTS = [
  { id: 'contact_us', label: 'Contact & Callback' },
  { id: 'training_interest', label: 'Training Interest' },
  { id: 'registration', label: 'Registration Leads' },
  { id: 'payment_recovery', label: 'Payment Recovery' },
  { id: 'converted', label: 'Converted Leads' },
  { id: '', label: 'Full Lead Database' },
]

export function LeadImportsExports() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')
  const [duplicateMode, setDuplicateMode] = useState('update')
  const [assignMode, setAssignMode] = useState('unassigned')
  const [imports, setImports] = useState<CrmImportRecord[]>([])

  const loadImports = () => {
    crmService.listImports(20).then(setImports).catch(() => setImports([]))
  }

  useEffect(() => {
    loadImports()
  }, [])

  const exportView = async (view?: string) => {
    setExporting(true)
    try {
      const blob = await crmService.exportLeads(view ? { view } : undefined)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-${view || 'all'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const downloadTemplate = async () => {
    const blob = await crmService.downloadImportTemplate()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lead-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (file: File | null) => {
    if (!file) return
    setImporting(true)
    setMsg('')
    try {
      const r = await crmService.importLeads(file, { duplicateMode, assignMode })
      const errNote = r.errors?.length ? ` · ${r.errors.length} row errors` : ''
      setMsg(`Import ${r.status}: ${r.added} added, ${r.updated} updated${errNote}`)
      loadImports()
    } catch {
      setMsg('Import failed.')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="lc-card p-5">
          <h3 className="text-sm font-semibold text-slate-900">Upload leads</h3>
          <p className="mt-0.5 text-xs text-slate-500">CSV · up to 10,000 rows</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center hover:border-[#2563eb]/40 hover:bg-slate-100/80"
          >
            <Upload className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">Drop a lead file here or browse</p>
            <p className="mt-1 text-xs text-slate-500">Required columns: name, mobile. Optional: email, course</p>
          </button>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              value={duplicateMode}
              onChange={(e) => setDuplicateMode(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-700"
            >
              <option value="update">Update existing duplicates</option>
              <option value="skip">Skip duplicates</option>
            </select>
            <select
              value={assignMode}
              onChange={(e) => setAssignMode(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-700"
            >
              <option value="unassigned">Keep as unassigned</option>
              <option value="round_robin">Round-robin assign</option>
            </select>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => void downloadTemplate()} className="text-xs font-semibold text-[#2563eb] hover:underline">
              Download template
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Upload & import'}
            </button>
          </div>
          {msg && <p className={`mt-2 text-xs ${msg.includes('failed') ? 'text-red-600' : 'text-emerald-700'}`}>{msg}</p>}
        </div>

        <div className="lc-card p-5">
          <h3 className="text-sm font-semibold text-slate-900">Quick exports</h3>
          <p className="mt-0.5 text-xs text-slate-500">Download common lead sections</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {QUICK_EXPORTS.map((e) => (
              <button
                key={e.label}
                type="button"
                disabled={exporting}
                onClick={() => exportView(e.id || undefined)}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium hover:border-[#2563eb]/30 disabled:opacity-50"
              >
                <span>{e.label}</span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  CSV <Download className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lc-card p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-slate-900">Recent imports</h3>
        <p className="mt-0.5 text-xs text-slate-500">Latest data operations</p>
        <ul className="mt-4 divide-y divide-gray-100">
          {imports.length === 0 ? (
            <li className="py-8 text-center text-sm text-slate-500">No imports yet.</li>
          ) : (
            imports.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                  {r.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.filename}</p>
                  <p className="text-xs text-slate-500">{r.meta}{r.errorCount ? ` · ${r.errorCount} errors` : ''}</p>
                </div>
                <span className={`text-xs font-semibold capitalize ${r.status === 'completed' ? 'text-emerald-600' : r.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
                  {r.status}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
