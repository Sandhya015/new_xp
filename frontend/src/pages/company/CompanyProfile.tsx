import { useState } from 'react'
import { Building2, CheckCircle } from 'lucide-react'

/**
 * Company Dashboard — Company Profile (Part 4A §4). Sections, completion meter, verified badge. API later.
 */
const SECTIONS = [
  { id: 'company-info', title: 'Company Information', fields: 'Logo, Name, Type, Industry, Description, Year, Size, Website' },
  { id: 'contact', title: 'Contact Details', fields: 'Contact Person, Email, Phone, Address' },
  { id: 'social', title: 'Social & Links', fields: 'LinkedIn, GST (optional)' },
  { id: 'account', title: 'Account & Security', fields: 'Change Password' },
]

export function CompanyProfile() {
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const profileComplete = 75
  const isVerified = false

  return (
    <div className="space-y-6 w-full max-w-4xl">
      <h2 className="text-lg font-semibold text-brand-navy">Company Profile</h2>

      {/* Completion meter — doc 4.2 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-gray">Profile completion</p>
            <p className="text-2xl font-bold text-brand-navy">{profileComplete}%</p>
          </div>
          <div className="flex-1 max-w-xs">
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-brand-accent transition-all"
                style={{ width: `${profileComplete}%` }}
              />
            </div>
          </div>
        </div>
        {profileComplete < 100 && (
          <p className="mt-2 text-sm text-amber-700">A complete profile gets 3x more applicants!</p>
        )}
        {isVerified && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
            <CheckCircle className="h-4 w-4" /> Verified Company
          </div>
        )}
      </div>

      {/* Profile sections — doc 4.1 */}
      {SECTIONS.map((section) => (
        <div key={section.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-accent" />
              <h3 className="font-semibold text-brand-navy">{section.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => setEditingSection(editingSection === section.id ? null : section.id)}
              className="text-sm font-medium text-brand-accent hover:underline"
            >
              {editingSection === section.id ? 'Cancel' : 'Edit'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-gray">{section.fields}</p>
          {editingSection === section.id && (
            <p className="mt-4 text-sm text-slate-gray rounded-lg bg-gray-50 p-4">Form fields for this section will load here (API wiring later).</p>
          )}
        </div>
      ))}
    </div>
  )
}
