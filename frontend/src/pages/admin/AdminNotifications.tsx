import { useState } from 'react'
import { Bell, Send } from 'lucide-react'

/**
 * Admin — Notifications. Part 5A §15. Broadcast composer + notification logs.
 */
export function AdminNotifications() {
  const [activeTab, setActiveTab] = useState<'broadcast' | 'logs'>('broadcast')

  return (
    <div className="space-y-6 w-full max-w-4xl">
      <h2 className="text-lg font-semibold text-brand-navy">Notifications</h2>

      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('broadcast')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'broadcast' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Broadcast Notification
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'logs' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Notification Logs
        </button>
      </div>

      {activeTab === 'broadcast' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-brand-navy">Send Platform Notification</h3>
          <p className="mt-1 text-sm text-slate-gray">Target audience, title, message, delivery channels (In-App / Email / SMS / Push). Schedule send optional.</p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Target Audience *</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                <option value="">Select</option>
                <option>All Students</option>
                <option>Specific University</option>
                <option>Specific Course</option>
                <option>Enrolled in Training X</option>
                <option>All Companies</option>
                <option>All Users</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Notification Title (max 100 chars)</label>
              <input type="text" placeholder="Short title" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Message (max 500 chars)</label>
              <textarea rows={4} placeholder="Full message body" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Delivery Channels</label>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" className="rounded text-brand-accent" /> In-App</label>
                <label className="flex items-center gap-2"><input type="checkbox" className="rounded text-brand-accent" /> Email</label>
                <label className="flex items-center gap-2"><input type="checkbox" className="rounded text-brand-accent" /> SMS</label>
                <label className="flex items-center gap-2"><input type="checkbox" className="rounded text-brand-accent" /> Push</label>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
                <Send className="h-4 w-4" /> Send Now
              </button>
              <button type="button" className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Schedule Send
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-brand-navy">Notification Logs</h3>
          <p className="mt-1 text-sm text-slate-gray">All broadcast notifications: Date, Target, Message, Channels, Recipients Count, Delivery Status.</p>
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12 text-slate-gray text-sm">
            <Bell className="h-10 w-10 text-gray-300 mb-2" />
            <p>Logs will load from API.</p>
          </div>
        </div>
      )}
    </div>
  )
}
