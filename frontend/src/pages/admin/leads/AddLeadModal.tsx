import { FormEvent, useEffect, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { crmService } from '@/services/crmService'
import { adminService } from '@/services/adminService'
import { useLeadCommand } from './LeadCommandContext'

const SOURCE_OPTIONS = [
  { value: 'manual.entry', label: 'Manual entry' },
  { value: 'training.interest', label: 'Training interest' },
  { value: 'callback.requested', label: 'Callback request' },
  { value: 'campaign', label: 'Campaign / QR' },
  { value: 'contact.submitted', label: 'Contact form' },
]

type CourseOption = { id: string; title: string }

export function AddLeadModal() {
  const { addLeadOpen, setAddLeadOpen, refresh } = useLeadCommand()
  const [fullName, setFullName] = useState('')
  const [mobile, setMobile] = useState('')
  const [courseId, setCourseId] = useState('')
  const [source, setSource] = useState('manual.entry')
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!addLeadOpen) return
    adminService
      .getCourses({ status: 'active' })
      .then((r) => {
        const items = (r.items || []) as Array<{ _id?: string; id?: string; title?: string; name?: string }>
        setCourses(
          items.map((c) => ({
            id: String(c._id || c.id || ''),
            title: c.title || c.name || 'Course',
          })),
        )
      })
      .catch(() => setCourses([]))
  }, [addLeadOpen])

  const close = () => {
    setAddLeadOpen(false)
    setError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const course = courses.find((c) => c.id === courseId)
      const r = await crmService.createLead({
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        source,
        courseId: course?.id,
        courseTitle: course?.title,
      })
      if (!r.ok) {
        setError(r.error === 'mobile_or_email_required' ? 'Mobile number is required.' : r.error || 'Could not create lead')
        return
      }
      setFullName('')
      setMobile('')
      setCourseId('')
      setSource('manual.entry')
      close()
      await refresh()
    } catch {
      setError('Could not create lead. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!addLeadOpen) return null

  return (
    <>
      <button type="button" className="lc-modal-backdrop" aria-label="Close" onClick={close} />
      <div className="lc-modal" role="dialog" aria-labelledby="add-lead-title">
        <button type="button" onClick={close} className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
        <div className="lc-modal-icon">
          <Plus className="h-6 w-6 text-[#2563eb]" strokeWidth={2.5} />
        </div>
        <h2 id="add-lead-title" className="text-center text-lg font-bold text-slate-900">
          Add lead
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Create a lead and send it to the Assignment Center.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Student name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              placeholder="Aman Kumar"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Mobile number <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              placeholder="9876543210"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Training</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            >
              <option value="">Select training program</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] py-2.5 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Creating…' : 'Create lead'}
          </button>
        </form>
      </div>
    </>
  )
}
