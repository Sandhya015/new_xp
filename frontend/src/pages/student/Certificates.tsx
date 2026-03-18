import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Award, Download, ShieldCheck, Share2 } from 'lucide-react'
import { certificateService } from '@/services/certificateService'

/**
 * Student Dashboard — My Certificates (SD-WF-14). API wired.
 */
export function Certificates() {
  const [items, setItems] = useState<Array<{ id: string; certNo: string; programName: string; university: string; issueDate: string; status: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    certificateService
      .listMy()
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="text-lg font-bold text-brand-navy">My Certificates</h2>
      <p className="mt-1 text-sm text-slate-gray">View and download your verified certificates.</p>

      {loading ? (
        <p className="py-8 text-slate-gray">Loading...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Award className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 font-medium text-gray-600">No certificates yet</p>
          <p className="mt-1 text-sm text-slate-gray">Complete a training to earn your certificate.</p>
          <Link to="/dashboard/training" className="mt-4 inline-block rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
            Explore Training
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <Award className="h-10 w-10 text-brand-accent shrink-0" />
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{c.status || 'Valid'}</span>
              </div>
              <h3 className="mt-2 font-semibold text-brand-navy">{c.programName || 'Certificate'}</h3>
              <p className="mt-0.5 text-xs text-slate-gray">{c.university} · {c.issueDate}</p>
              <p className="mt-1 text-xs font-mono text-gray-600">ID: {c.certNo}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
                <Link
                  to={`/verify?cert=${encodeURIComponent(c.certNo)}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Verify
                </Link>
                <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
