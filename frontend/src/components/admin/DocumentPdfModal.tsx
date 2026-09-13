import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, X } from 'lucide-react'
import { documentsService } from '@/services/documentsService'

type Props = {
  docId: string
  title: string
  subtitle?: string
  onClose: () => void
}

export function DocumentPdfModal({ docId, title, subtitle, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setLoading(true)
    setError(null)
    setBlobUrl(null)

    documentsService
      .download(docId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Could not load PDF.'
        setError(msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [docId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-gray">{subtitle}</p> : null}
            <p className="mt-0.5 text-xs text-slate-gray">
              Certificates are rendered live with the latest layout. Other documents use the stored PDF from generation time.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {blobUrl ? (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50"
              >
                <ExternalLink className="h-3.5 w-3.5" /> New tab
              </a>
            ) : null}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-[50vh] flex-1 bg-gray-50 p-2">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-24 text-sm text-slate-gray">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading PDF…
            </p>
          ) : error ? (
            <p className="mx-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-sm text-amber-900">{error}</p>
          ) : blobUrl ? (
            <iframe title={title} src={blobUrl} className="h-[min(75vh,820px)] w-full rounded-lg border border-gray-200 bg-white" />
          ) : null}
        </div>
      </div>
    </div>
  )
}
