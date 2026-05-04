import { useEffect, useState } from 'react'
import { adminService } from '@/services/adminService'
import { Loader2 } from 'lucide-react'

type Row = {
  id: string
  ticketId: string
  studentName: string
  studentEmail: string
  subject: string
  category: string
  status: string
  priority: string
  createdAt: string
  updatedAt?: string
}

const CATEGORIES = ['', 'Technical', 'Billing', 'Course', 'Certificate', 'Other']

export function AdminTickets() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    id: string
    ticketId: string
    studentName: string
    studentEmail: string
    subject: string
    category: string
    description: string
    status: string
    priority: string
    createdAt: string
    updatedAt?: string
    messages?: Array<{ from: string; body: string; createdAt: string }>
  } | null>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    adminService
      .listSupportTickets({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      .then((r) => setItems(r.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [statusFilter, categoryFilter, priorityFilter, dateFrom, dateTo])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    adminService.getSupportTicket(selectedId).then(setDetail).catch(() => setDetail(null))
  }, [selectedId])

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return
    setBusy(true)
    try {
      await adminService.replySupportTicket(selectedId, reply.trim())
      setReply('')
      const d = await adminService.getSupportTicket(selectedId)
      setDetail(d)
      load()
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (st: string) => {
    if (!selectedId) return
    setBusy(true)
    try {
      await adminService.setSupportTicketStatus(selectedId, st)
      const d = await adminService.getSupportTicket(selectedId)
      setDetail(d)
      load()
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = (s: string) => s.replace(/_/g, ' ')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Tickets</h1>
        <p className="text-sm text-slate-gray mt-1">
          Student support requests, filters, and replies (emailed to students when SMTP is configured).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
        <label className="text-sm text-gray-700">
          Status{' '}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-1 mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="text-sm text-gray-700">
          Category{' '}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="ml-1 mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c || 'all'} value={c}>
                {c || 'All'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          Priority{' '}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="ml-1 mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="text-sm text-gray-700">
          From{' '}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
          />
        </label>
        <label className="text-sm text-gray-700">
          To{' '}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
          />
        </label>
        <button type="button" onClick={load} className="text-sm font-medium text-brand-accent hover:underline">
          Refresh
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden min-w-0">
          <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase text-gray-500">All tickets</div>
          {loading ? (
            <div className="flex justify-center py-12 text-slate-gray">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-slate-gray">No tickets match the filters.</p>
          ) : (
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">ID</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Subject</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Student</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Category</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Priority</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Created</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((t) => (
                    <tr
                      key={t.id}
                      className={`cursor-pointer hover:bg-brand-light-bg/50 ${selectedId === t.id ? 'bg-brand-light-bg' : ''}`}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">{t.ticketId}</td>
                      <td className="px-3 py-2 text-gray-900 max-w-[10rem] truncate">{t.subject}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 max-w-[8rem]">
                        <span className="block font-medium text-gray-800 truncate">{t.studentName || '—'}</span>
                        <span className="block truncate">{t.studentEmail}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">{t.category}</td>
                      <td className="px-3 py-2 text-xs capitalize">{t.priority}</td>
                      <td className="px-3 py-2 text-xs capitalize whitespace-nowrap">{statusLabel(t.status)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{t.createdAt?.slice(0, 10) || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{t.updatedAt?.slice(0, 10) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 min-h-[320px] min-w-0">
          {!detail ? (
            <p className="text-sm text-slate-gray">Select a ticket to view the thread.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">{detail.subject}</h2>
                <p className="text-xs text-slate-gray mt-1">
                  {detail.ticketId} · {detail.studentName} &lt;{detail.studentEmail}&gt; · {detail.category} ·{' '}
                  <span className="capitalize">{detail.priority}</span>
                </p>
                <p className="text-xs text-slate-gray mt-0.5">
                  Created {detail.createdAt || '—'}
                  {detail.updatedAt ? ` · Updated ${detail.updatedAt}` : ''}
                </p>
              </div>
              {detail.description ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
                  {detail.description}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {(['open', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus(st)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
                      detail.status === st
                        ? 'border-brand-accent bg-brand-light-bg text-brand-accent'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-3 bg-gray-50 text-sm">
                {(detail.messages || []).map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-2 ${m.from === 'staff' ? 'bg-indigo-50 border border-indigo-100 ml-4' : 'bg-white border border-gray-200 mr-4'}`}
                  >
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      {m.from} · {m.createdAt}
                    </p>
                    <p className="text-gray-800 whitespace-pre-wrap mt-1">{m.body}</p>
                  </div>
                ))}
              </div>
              {detail.status !== 'closed' ? (
                <>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Reply to student…"
                  />
                  <button
                    type="button"
                    disabled={busy || reply.trim().length < 2}
                    onClick={sendReply}
                    className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Send reply
                  </button>
                </>
              ) : (
                <p className="text-xs text-slate-gray">Ticket is closed.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
