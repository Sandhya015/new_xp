/**
 * Student Dashboard — Help & Support: Raise Ticket + My Tickets (SD-WF-19). API wired.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Plus, Send } from 'lucide-react'
import { supportService, type SupportTicket } from '@/services/supportService'

const CATEGORIES = ['Technical', 'Billing', 'Course', 'Certificate', 'Other']
const PRIORITIES = ['low', 'medium', 'high']

export function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'faq' | 'raise' | 'mytickets'>('mytickets')
  const [form, setForm] = useState({ subject: '', category: 'Other', description: '', priority: 'medium' })
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState('')

  useEffect(() => {
    supportService
      .list()
      .then((res) => setTickets(res.items || []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = () => {
    if (!form.subject.trim()) return
    if (form.description.trim().length < 20) {
      return
    }
    setSubmitting(true)
    supportService
      .create({
        subject: form.subject.trim(),
        category: form.category,
        description: form.description.trim(),
        priority: form.priority,
      })
      .then((res) => {
        setSubmitSuccess(`Ticket #${res.ticketId} submitted successfully. We will respond within 24 hours.`)
        setForm({ subject: '', category: 'Other', description: '', priority: 'medium' })
        return supportService.list()
      })
      .then((res) => setTickets(res.items || []))
      .catch(() => {})
      .finally(() => {
        setSubmitting(false)
        setTimeout(() => setSubmitSuccess(''), 5000)
      })
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="text-lg font-bold text-brand-navy">Help & Support</h2>
      <p className="mt-1 text-sm text-slate-gray">Get help with your trainings and account. Raise a ticket or view existing tickets.</p>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('raise')}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium ${
            activeTab === 'raise' ? 'border-b-2 border-brand-accent text-brand-accent' : 'text-slate-gray hover:text-brand-navy'
          }`}
        >
          <Plus className="h-4 w-4" /> Raise a Ticket
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mytickets')}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium ${
            activeTab === 'mytickets' ? 'border-b-2 border-brand-accent text-brand-accent' : 'text-slate-gray hover:text-brand-navy'
          }`}
        >
          <MessageSquare className="h-4 w-4" /> My Tickets
        </button>
      </div>

      {activeTab === 'raise' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-brand-navy">Raise a Ticket</h3>
          <p className="mt-1 text-sm text-slate-gray">Describe your issue. We will get back to you within 24 hours.</p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject *</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Brief subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description * (min 20 characters)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Describe your issue in detail..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            {submitSuccess && <p className="text-sm text-emerald-600">{submitSuccess}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !form.subject.trim() || form.description.trim().length < 20}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Submit Ticket
            </button>
          </div>
        </div>
      )}

      {activeTab === 'mytickets' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="font-semibold text-brand-navy">My Tickets</h3>
            <p className="mt-0.5 text-sm text-slate-gray">All support tickets you have raised</p>
          </div>
          {loading ? (
            <div className="p-6 text-center text-slate-gray">Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 font-medium text-gray-600">No tickets yet</p>
              <p className="mt-1 text-sm text-slate-gray">Raise a ticket using the tab above if you need help.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{t.subject}</p>
                    <p className="text-xs text-slate-gray">#{t.ticketId} · {t.category} · {new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    t.status === 'open' ? 'bg-amber-100 text-amber-800' :
                    t.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-slate-gray">
        <Link to="/contact" className="font-medium text-brand-accent hover:underline">Contact Us</Link> for general inquiries.
      </p>
    </div>
  )
}
