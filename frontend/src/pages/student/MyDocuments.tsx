import { useEffect, useState } from 'react'
import { Download, FileText, Loader2, Printer } from 'lucide-react'
import { documentsService, type DocumentItem } from '@/services/documentsService'

export function MyDocuments() {
  const [items, setItems] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    documentsService
      .listMy()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const openPdf = async (doc: DocumentItem, download = false) => {
    const blob = await documentsService.downloadMy(doc.id, doc)
    const url = URL.createObjectURL(blob)
    if (download) {
      const a = document.createElement('a')
      a.href = url
      a.download = 'document.pdf'
      a.click()
    } else {
      window.open(url, '_blank')
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-brand-navy">My Documents</h2>
        <p className="mt-1 text-sm text-slate-gray">Offer letters, ID cards, logbooks, attendance logs, and certificates issued to you.</p>
      </div>

      {loading ? (
        <p className="inline-flex items-center gap-2 py-8 text-slate-gray">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 font-medium text-gray-600">No documents yet</p>
          <p className="mt-1 text-sm text-slate-gray">Documents issued by your trainer will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((d) => (
            <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <FileText className="h-8 w-8 text-brand-accent" />
              <h3 className="mt-2 font-semibold text-brand-navy">{d.title}</h3>
              <p className="text-sm text-slate-gray">{d.courseTitle}</p>
              {d.letterNo ? <p className="mt-1 font-mono text-xs text-gray-600">{d.letterNo}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openPdf(d)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => openPdf(d, true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => openPdf(d).then(() => window.print())}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
