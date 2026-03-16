import { useState } from 'react'
import { Settings, ChevronDown, ChevronRight } from 'lucide-react'

/**
 * Admin — System Settings (SA Only). Part 5A §14. Platform config, communication, moderation, legal.
 */
const SECTIONS = [
  { id: 'platform', title: 'Platform Configuration', items: 'Universities, Streams, Courses, Modes, Duration options, Fee & GST, Refund policy, Certificate templates, Digital signatures, Coupon codes' },
  { id: 'communication', title: 'Communication Settings', items: 'Email templates, SMS templates, WhatsApp config, Push notification config, SMTP configuration' },
  { id: 'moderation', title: 'Platform Moderation', items: 'Company auto-approve, Internship moderation, Student email verification, Maintenance mode, New registration toggle' },
  { id: 'legal', title: 'Legal & Content', items: 'Privacy Policy, Terms & Conditions, Refund Policy page, About Us content, SEO settings' },
]

export function SystemSettings() {
  const [openSection, setOpenSection] = useState<string | null>('platform')

  return (
    <div className="space-y-6 w-full max-w-4xl">
      <h2 className="text-lg font-semibold text-brand-navy">System Settings</h2>
      <p className="text-sm text-slate-gray">Master configuration for the entire platform. Super Admin only.</p>

      {SECTIONS.map((section) => (
        <div key={section.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              {openSection === section.id ? (
                <ChevronDown className="h-5 w-5 text-slate-gray" />
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-gray" />
              )}
              <Settings className="h-5 w-5 text-brand-accent" />
              <span className="font-semibold text-brand-navy">{section.title}</span>
            </div>
          </button>
          {openSection === section.id && (
            <div className="border-t border-gray-200 px-5 py-4 bg-gray-50/50">
              <p className="text-sm text-slate-gray">{section.items}</p>
              <p className="mt-3 text-xs text-slate-gray">Form controls and toggles will load here (API wiring later).</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
