/**
 * Student Dashboard — Help & Support (S-6): contact, FAQ (CMS), tickets.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Plus, Send, X, Loader2, Mail, Phone, MapPin, Facebook, Instagram, Linkedin, Youtube, ChevronDown } from 'lucide-react'
import { supportService, type SupportTicket } from '@/services/supportService'
import { fetchSupportContent, type SupportFaqItem } from '@/services/supportContentService'
import { SOCIAL_LINKS } from '@/config/socialLinks'

const CATEGORIES = ['Technical', 'Billing', 'Course', 'Certificate', 'Other']
const PRIORITIES = ['low', 'medium', 'high']

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'raise' | 'mytickets'>('mytickets')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [thread, setThread] = useState<{
    id: string
    ticketId: string
    subject: string
    status: string
    messages: Array<{ from: string; body: string; createdAt: string }>
  } | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [followUp, setFollowUp] = useState('')
  const [form, setForm] = useState({ subject: '', category: 'Other', description: '', priority: 'medium' })
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [faqs, setFaqs] = useState<SupportFaqItem[]>([])
  const [faqOpenId, setFaqOpenId] = useState<string | null>(null)
  const [contact, setContact] = useState<{
    email: string
    phone: string
    phoneTel: string
    hours: string
    address: string
    whatsappUrl: string
    social: { facebook: string; instagram: string; linkedin: string; x: string; youtube: string }
  } | null>(null)

  useEffect(() => {
    fetchSupportContent()
      .then((d) => {
        setFaqs(d.faqs || [])
        setContact(d.contact)
      })
      .catch(() => {
        setFaqs([])
        setContact(null)
      })
  }, [])

  useEffect(() => {
    supportService
      .list()
      .then((res) => setTickets(res.items || []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!threadId) {
      setThread(null)
      return
    }
    setThreadLoading(true)
    supportService
      .getById(threadId)
      .then(setThread)
      .catch(() => setThread(null))
      .finally(() => setThreadLoading(false))
  }, [threadId])

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

  const c = contact

  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h2 className="text-lg font-bold text-brand-navy">Help & Support</h2>
        <p className="mt-1 text-sm text-slate-gray">
          Contact us, read FAQs, or open a ticket. We typically reply within one business day.
        </p>
      </div>

      {/* (1) Contact */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-brand-navy">Contact information</h3>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <Mail className="h-5 w-5 text-brand-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Email</p>
              <a href={`mailto:${c?.email ?? 'contact@xpertintern.com'}`} className="text-sm text-slate-gray hover:text-brand-accent">
                {c?.email ?? 'contact@xpertintern.com'}
              </a>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
              <Phone className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Phone</p>
              <a href={`tel:${c?.phoneTel ?? '+917004762654'}`} className="text-sm text-slate-gray hover:text-brand-accent">
                {c?.phone ?? '7004762654'}
              </a>
              <p className="text-xs text-slate-500 mt-0.5">{c?.hours ?? 'Mon-Sat: 9AM - 6PM'}</p>
            </div>
          </div>
          <div className="flex gap-3 sm:col-span-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <MapPin className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Address</p>
              <p className="text-sm text-slate-gray">
                {c?.address ?? 'Arfabadd Colony, East Nahar Road, Bajrangpuri, Patna - 800007'}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-gray-700">Social</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={c?.social.facebook ?? SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1877F2] text-white hover:opacity-90" aria-label="Facebook">
            <Facebook className="h-4 w-4" />
          </a>
          <a href={c?.social.instagram ?? SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-pink-500 text-white hover:opacity-90" aria-label="Instagram">
            <Instagram className="h-4 w-4" />
          </a>
          <a href={c?.social.linkedin ?? SOCIAL_LINKS.linkedin} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A66C2] text-white hover:opacity-90" aria-label="LinkedIn">
            <Linkedin className="h-4 w-4" />
          </a>
          <a href={c?.social.x ?? SOCIAL_LINKS.x} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white hover:opacity-90" aria-label="X">
            <X className="h-4 w-4" />
          </a>
          <a href={c?.whatsappUrl ?? 'https://wa.me/917004762654'} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366] text-white hover:opacity-90" aria-label="WhatsApp">
            <WhatsAppIcon className="h-4 w-4" />
          </a>
          <a href={c?.social.youtube ?? SOCIAL_LINKS.youtube} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF0000] text-white hover:opacity-90" aria-label="YouTube">
            <Youtube className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Same details as our public <Link to="/contact" className="font-medium text-brand-accent hover:underline">Contact Us</Link> page.
        </p>
      </section>

      {/* (2) FAQ */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-brand-navy">Frequently asked questions</h3>
        {faqs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-gray">No FAQs yet. Check back soon.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
            {faqs.map((f) => {
              const open = faqOpenId === f.id
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setFaqOpenId(open ? null : f.id)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
                  >
                    <span>{f.question}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open ? (
                    <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                      {f.answer}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* (3) tickets */}
      <section className="space-y-4">
        <h3 className="font-semibold text-brand-navy">Tickets</h3>
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
            <p className="text-sm text-slate-gray">Describe your issue. We will get back to you within 24 hours.</p>
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
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
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
              <p className="text-sm text-slate-gray">All support tickets you have raised</p>
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
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setThreadId(t.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setThreadId(t.id)}
                    className="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50"
                  >
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
      </section>

      {threadId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-brand-navy">{thread?.subject || 'Ticket'}</h3>
              <button type="button" className="rounded p-1 text-gray-500 hover:bg-gray-100" onClick={() => setThreadId(null)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-sm">
              {threadLoading ? (
                <div className="flex justify-center py-8 text-slate-gray">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : thread ? (
                <>
                  <p className="text-xs text-slate-gray">{thread.ticketId} · {thread.status}</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(thread.messages || []).map((m, i) => (
                      <div
                        key={i}
                        className={`rounded-lg p-2 text-sm ${m.from === 'staff' ? 'bg-indigo-50 border border-indigo-100 ml-3' : 'bg-gray-50 border border-gray-200 mr-3'}`}
                      >
                        <p className="text-[10px] uppercase text-gray-500">{m.from}</p>
                        <p className="text-gray-800 whitespace-pre-wrap mt-1">{m.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{m.createdAt}</p>
                      </div>
                    ))}
                  </div>
                  {thread.status !== 'closed' ? (
                    <div className="pt-2 space-y-2 border-t">
                      <textarea
                        value={followUp}
                        onChange={(e) => setFollowUp(e.target.value)}
                        rows={3}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Add a message…"
                      />
                      <button
                        type="button"
                        disabled={followUp.trim().length < 2}
                        onClick={() => {
                          if (!threadId) return
                          supportService.postFollowUp(threadId, followUp.trim()).then(() => {
                            setFollowUp('')
                            return supportService.getById(threadId)
                          }).then(setThread).then(() => supportService.list().then((r) => setTickets(r.items || [])))
                        }}
                        className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-slate-gray">Could not load ticket.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
