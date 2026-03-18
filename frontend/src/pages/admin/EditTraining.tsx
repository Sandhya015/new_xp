/**
 * Admin — Edit Training basic details. Loads course by id, submits via PATCH. Batch/curriculum edits are in Manage Training tabs.
 */
import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { adminService } from '@/services/adminService'

export function EditTraining() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [category, setCategory] = useState('')
  const [duration, setDuration] = useState('')
  const [durationValue, setDurationValue] = useState('')
  const [durationUnit, setDurationUnit] = useState('weeks')
  const [mode, setMode] = useState('')
  const [price, setPrice] = useState('')
  const [trainerName, setTrainerName] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!id) return
    adminService.getCourse(id).then((c: Record<string, unknown>) => {
      setTitle(String(c.title ?? ''))
      setDescription(String(c.description ?? ''))
      setShortDescription(String(c.shortDescription ?? ''))
      setCategory(String(c.category ?? ''))
      setDuration(String(c.duration ?? ''))
      setDurationValue(String(c.durationValue ?? ''))
      setDurationUnit(String(c.durationUnit ?? 'weeks'))
      setMode(String(c.mode ?? 'Online'))
      setPrice(String(c.price ?? ''))
      setTrainerName(String(c.trainerName ?? ''))
      setActive(Boolean(c.active !== false))
    }).catch(() => setError('Failed to load course')).finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !title.trim()) {
      setError('Title is required.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await adminService.updateCourse(id, {
        title: title.trim(),
        description: description.trim(),
        shortDescription: shortDescription.trim(),
        fullDescription: description.trim(),
        category: category || 'technical',
        duration: duration || `${durationValue} ${durationUnit}`.trim(),
        durationValue: durationValue || undefined,
        durationUnit: durationUnit || 'weeks',
        mode: mode || 'Online',
        price: price ? parseInt(price, 10) : 0,
        trainerName: trainerName.trim() || undefined,
        active,
      })
      navigate(`/admin/courses/${id}/manage`, { replace: true })
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response
        ? String((e.response as { data?: { error?: string } }).data?.error ?? 'Update failed')
        : 'Update failed'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-gray">Loading…</div>

  return (
    <div className="space-y-6 w-full max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to={`/admin/courses/${id}/manage`} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-semibold text-brand-navy">Edit Training Details</h2>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Short description</label>
          <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Full description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select</option>
              <option value="technical">Technical</option>
              <option value="non-technical">Non-Technical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Duration value</label>
            <input type="text" value={durationValue} onChange={(e) => setDurationValue(e.target.value)} placeholder="e.g. 4" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Duration unit</label>
            <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="weeks">Weeks</option>
              <option value="days">Days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Mode</label>
            <input type="text" value={mode} onChange={(e) => setMode(e.target.value)} placeholder="Online" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fee (₹)</label>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Trainer name</label>
            <input type="text" value={trainerName} onChange={(e) => setTrainerName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="active" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded text-brand-accent" />
          <label htmlFor="active" className="text-sm font-medium text-gray-700">Published (visible to students)</label>
        </div>
        <div className="flex gap-3 pt-2">
          <Link to={`/admin/courses/${id}/manage`} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white">
            <Save className="h-4 w-4" /> Save changes
          </button>
        </div>
      </form>
    </div>
  )
}
