import { useEffect, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { adminService } from '@/services/adminService'

type FaqRow = { id: string; question: string; answer: string; sortOrder: number }

export function AdminSupportFAQ() {
  const [rows, setRows] = useState<FaqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    setLoading(true)
    adminService
      .getSupportContentAdmin()
      .then((r) => setRows((r.faqs || []).map((x, i) => ({ ...x, sortOrder: x.sortOrder ?? i }))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const normalized = rows.map((r, i) => ({
        id: r.id || `faq_${i}`,
        question: r.question.trim(),
        answer: r.answer.trim(),
        sortOrder: r.sortOrder ?? i,
      })).filter((r) => r.question.length > 0)
      await adminService.putSupportContentAdmin(normalized)
      setRows(normalized)
      setMessage({ text: 'Saved. Students will see updates on Help & Support.', ok: true })
    } catch {
      setMessage({ text: 'Could not save. Try again.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Help & Support — FAQs</h1>
        <p className="mt-1 text-sm text-slate-gray">
          Questions and answers shown in the student Help & Support page (accordion). Contact details match the public
          Contact page.
        </p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-gray">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={r.id || i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-medium text-gray-600">
                  Sort order
                  <input
                    type="number"
                    className="mt-1 w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                    value={r.sortOrder}
                    onChange={(e) =>
                      setRows((prev) => prev.map((x, j) => (j === i ? { ...x, sortOrder: Number(e.target.value) || 0 } : x)))
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Question</label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  value={r.question}
                  onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Answer</label>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  value={r.answer}
                  onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { id: `faq_${Date.now()}`, question: '', answer: '', sortOrder: prev.length },
              ])
            }
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> Add FAQ
          </button>
          {message ? <p className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p> : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save all
          </button>
        </div>
      )}
    </div>
  )
}
