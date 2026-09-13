import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Eye, Loader2, Trash2 } from 'lucide-react'
import { DocumentPdfModal } from '@/components/admin/DocumentPdfModal'
import { DocumentStudentPicker } from '@/components/admin/DocumentStudentPicker'
import { documentsService, type DocumentItem } from '@/services/documentsService'

type GenerateFn = (payload: {
  courseId: string
  variant: string
  studentIds: string[]
  inputs: Record<string, unknown>
}) => Promise<unknown>

type Props = {
  title: string
  docType: string
  variant?: string
  backTo?: string
  generateFn: GenerateFn
  renderInputs?: (inputs: Record<string, unknown>, setField: (key: string, value: unknown) => void) => ReactNode
  defaultInputs?: Record<string, unknown>
}

export function DocumentManageShell({
  title,
  docType,
  variant = 'technical',
  backTo = '/admin/documents',
  generateFn,
  renderInputs,
  defaultInputs = {},
}: Props) {
  const [tab, setTab] = useState<'generate' | 'manage'>('generate')
  const [courseId, setCourseId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [inputs, setInputs] = useState<Record<string, unknown>>(defaultInputs)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [items, setItems] = useState<DocumentItem[]>([])
  const [manageLoading, setManageLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [viewDoc, setViewDoc] = useState<DocumentItem | null>(null)

  const loadManage = useCallback(() => {
    setManageLoading(true)
    documentsService
      .manage(docType, { q: search || undefined })
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setManageLoading(false))
  }, [docType, search])

  useEffect(() => {
    if (tab === 'manage') loadManage()
  }, [tab, loadManage])

  const handleGenerate = async () => {
    if (!courseId || selected.length === 0) {
      setMessage('Select a course and at least one student.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const res = (await generateFn({ courseId, variant, studentIds: selected, inputs })) as { created?: number }
      setMessage(`Generated ${res.created ?? selected.length} document(s). Open Manage → View to inspect each PDF.`)
      setSelected([])
      setTab('manage')
    } catch {
      setMessage('Generation failed. Check inputs and try again.')
    } finally {
      setBusy(false)
    }
  }

  const setField = (key: string, value: unknown) => setInputs((prev) => ({ ...prev, [key]: value }))

  const downloadDoc = (d: DocumentItem) => {
    documentsService.download(d.id).then((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${d.letterNo || d.studentName || d.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-slate-gray hover:text-brand-navy">
          <ArrowLeft className="h-4 w-4" /> Documents Hub
        </Link>
        <h1 className="text-xl font-bold text-brand-navy">{title}</h1>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {(
          [
            { id: 'generate' as const, label: 'Generate' },
            { id: 'manage' as const, label: 'Manage & View' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'generate' ? (
        <div className="space-y-4">
          {renderInputs ? (
            <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
              {renderInputs(inputs, setField)}
            </div>
          ) : null}
          <DocumentStudentPicker
            courseId={courseId}
            onCourseChange={setCourseId}
            selectedIds={selected}
            onChange={setSelected}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleGenerate}
              className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {busy ? 'Generating…' : 'Generate & Email'}
            </button>
            {message ? <p className="text-sm text-slate-gray">{message}</p> : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-gray">
            Click <strong>View</strong> on any row to see the exact PDF your system generated for that student.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or letter no"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={loadManage} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              Refresh
            </button>
          </div>
          {manageLoading ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-gray">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-gray">No documents yet. Generate first, then view them here.</p>
          ) : (
            <div className="overflow-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Letter No</th>
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2">{d.studentName}</td>
                      <td className="px-3 py-2 font-mono text-xs">{d.letterNo}</td>
                      <td className="px-3 py-2">{d.courseTitle}</td>
                      <td className="px-3 py-2">{d.createdAt?.slice(0, 10)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setViewDoc(d)}
                            className="inline-flex items-center gap-1 font-medium text-brand-accent hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadDoc(d)}
                            className="inline-flex items-center gap-1 text-gray-700 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </button>
                          <button
                            type="button"
                            onClick={() => documentsService.delete(d.id).then(loadManage)}
                            className="inline-flex items-center gap-1 text-red-600 hover:underline"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewDoc ? (
        <DocumentPdfModal
          docId={viewDoc.id}
          title={viewDoc.studentName || 'Student document'}
          subtitle={[viewDoc.courseTitle, viewDoc.letterNo].filter(Boolean).join(' · ')}
          onClose={() => setViewDoc(null)}
        />
      ) : null}
    </div>
  )
}

export function DocInput({
  label,
  name,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  name: string
  value: string | number
  onChange: (name: string, value: unknown) => void
  type?: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  )
}
