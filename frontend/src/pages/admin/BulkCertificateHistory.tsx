import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { adminService } from '@/services/adminService'

export function BulkCertificateHistory() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof adminService.getBulkCertificateJobs>>['items']>([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminService.getBulkCertificateJob>> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLoading(true)
    adminService
      .getBulkCertificateJobs()
      .then((r) => setItems(r.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const openDetail = async (id: string) => {
    setDetailId(id)
    setBusy(true)
    try {
      setDetail(await adminService.getBulkCertificateJob(id))
    } catch {
      setDetail(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admin/certificates" className="inline-flex items-center gap-1 text-sm text-brand-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Manage Internship Certs
        </Link>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Bulk certificate upload history</h2>
          <p className="text-sm text-slate-gray">Past bulk uploads with status and certificate lists.</p>
        </div>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-gray">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-gray">No bulk uploads yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Admin</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Rows</th>
                  <th className="px-3 py-2">Valid / Errors</th>
                  <th className="px-3 py-2">PDFs</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((j) => (
                  <tr
                    key={j.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => void openDetail(j.id)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{j.createdAt}</td>
                    <td className="px-3 py-2">{j.adminName || j.adminEmail}</td>
                    <td className="px-3 py-2">{j.fileName}</td>
                    <td className="px-3 py-2">{j.totalRows}</td>
                    <td className="px-3 py-2">
                      {j.validRows} / {j.errorRows}
                    </td>
                    <td className="px-3 py-2">
                      {j.pdfDone} done{j.pdfFailed ? ` · ${j.pdfFailed} failed` : ''}
                    </td>
                    <td className="px-3 py-2 capitalize">{j.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-brand-navy">Upload details</h3>
            {busy || !detail ? (
              <p className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : (
              <>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-gray">File</dt>
                    <dd>{detail.fileName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-gray">Admin</dt>
                    <dd>
                      {detail.adminName} ({detail.adminEmail})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-gray">When</dt>
                    <dd>{detail.createdAt}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-gray">Status</dt>
                    <dd className="capitalize">{detail.status.replace('_', ' ')}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-gray">Summary</dt>
                    <dd>{detail.message || `${detail.createdCount} created · ${detail.pdfDone} PDFs ready`}</dd>
                  </div>
                </dl>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-2 py-2">Cert No</th>
                        <th className="px-2 py-2">Name</th>
                        <th className="px-2 py-2">Domain</th>
                        <th className="px-2 py-2">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(detail.certificates || []).map((c) => (
                        <tr key={c.id}>
                          <td className="px-2 py-1.5 font-mono">{c.certNo}</td>
                          <td className="px-2 py-1.5">{c.studentName}</td>
                          <td className="px-2 py-1.5">{c.domain}</td>
                          <td className="px-2 py-1.5 capitalize" title={c.pdfError || undefined}>
                            {c.pdfStatus}
                            {c.pdfError ? ` — ${c.pdfError}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={() => { setDetailId(null); setDetail(null) }} className="rounded-lg border px-4 py-2 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
