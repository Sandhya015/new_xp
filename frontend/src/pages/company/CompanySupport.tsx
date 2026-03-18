import { useState } from 'react'
import { HelpCircle, MessageCircle, ListTodo, Phone, Mail } from 'lucide-react'

/**
 * Company Dashboard — Help & Support (Part 4A §11). FAQ + Raise Ticket + My Tickets. API later.
 */
export function CompanySupport() {
  const [activeTab, setActiveTab] = useState<'faq' | 'raise' | 'tickets'>('faq')
  const [faqSearch, setFaqSearch] = useState('')

  return (
    <div className="space-y-6 w-full max-w-4xl">
      <h2 className="text-lg font-semibold text-brand-navy">Help & Support</h2>

      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('faq')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'faq' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          FAQ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('raise')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'raise' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Raise a Ticket
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'tickets' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          My Tickets
        </button>
      </div>

      {activeTab === 'faq' && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="relative">
            <input
              type="search"
              placeholder="Search FAQs..."
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
            />
            <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          <p className="mt-4 text-sm text-slate-gray">FAQ accordion (Posting internships, Applicant management, Offer letters, Certificates, Account, Billing) — content loaded when API is connected.</p>
        </div>
      )}

      {activeTab === 'raise' && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-brand-navy">Raise a Support Ticket</h3>
          <p className="mt-1 text-sm text-slate-gray">Subject, Category (Account / Listings / Applicants / Billing / Other), Description, Attachment, Priority.</p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject *</label>
              <input type="text" placeholder="Short title" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category *</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
                <option value="">Select</option>
                <option>Account</option>
                <option>Listings</option>
                <option>Applicants</option>
                <option>Billing</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description *</label>
              <textarea rows={4} placeholder="Describe your issue (min 20 characters)" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
            <button type="button" className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
              Submit Ticket
            </button>
          </div>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-200">
            <h3 className="font-semibold text-brand-navy">My Tickets</h3>
            <p className="mt-1 text-sm text-slate-gray">List of raised tickets with status (Open / In Progress / Resolved / Closed).</p>
          </div>
          <div className="p-8 text-center text-slate-gray">
            <ListTodo className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 font-medium text-gray-600">No tickets yet.</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-5">
        <h3 className="font-semibold text-brand-navy">Direct Contact</h3>
        <div className="mt-3 flex flex-wrap gap-6">
          <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-gray hover:text-brand-accent">
            <MessageCircle className="h-4 w-4" /> WhatsApp Support
          </a>
          <a href="mailto:contact@xpertintern.com" className="flex items-center gap-2 text-sm text-slate-gray hover:text-brand-accent">
            <Mail className="h-4 w-4" /> 
          </a>
          <a href="tel:+919876543210" className="flex items-center gap-2 text-sm text-slate-gray hover:text-brand-accent">
            <Phone className="h-4 w-4" /> Call Support
          </a>
        </div>
      </div>
    </div>
  )
}
