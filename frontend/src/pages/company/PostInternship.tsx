import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Save, Send, ArrowLeft } from 'lucide-react'
import { internshipService } from '@/services/internshipService'

/**
 * Company Dashboard — Post Internship (CD-WF-04, CD-WF-05, CD-WF-07). Create / Edit. API wired.
 */
export function PostInternship() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const editId = searchParams.get('edit') || ''

  const [mode, setMode] = useState<'onsite' | 'remote' | 'hybrid'>('remote')
  const [stipendType, setStipendType] = useState<'paid' | 'unpaid'>('paid')
  const [title, setTitle] = useState('')
  const [domain, setDomain] = useState('')
  const [openings, setOpenings] = useState(1)
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [skills, setSkills] = useState('')
  const [location, setLocation] = useState('')
  const [duration, setDuration] = useState('')
  const [stipendAmount, setStipendAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editId) return
    setLoading(true)
    internshipService
      .getById(editId)
      .then((d) => {
        setTitle(d.title || '')
        setDomain(d.domain || '')
        setOpenings(Number(d.openings) || 1)
        setDescription(d.description || '')
        setRequirements(d.requirements || '')
        setSkills(d.skills || '')
        setLocation(d.location || '')
        setDuration(d.duration || '')
        setStipendAmount(typeof d.stipend === 'string' ? d.stipend : '')
        setDeadline(d.deadline || '')
        const t = (d.type || 'remote').toString().toLowerCase()
        setMode(t === 'onsite' || t === 'hybrid' ? t : 'remote')
        setStipendType(d.stipend && String(d.stipend) !== 'Unpaid' ? 'paid' : 'unpaid')
      })
      .catch(() => setError('Failed to load internship.'))
      .finally(() => setLoading(false))
  }, [editId])

  const buildPayload = (status: 'draft' | 'active') => ({
    title: title.trim() || 'Untitled',
    domain: domain.trim() || 'Other',
    openings: Math.max(1, openings),
    description: description.trim(),
    requirements: requirements.trim(),
    skills: skills.trim(),
    type: mode,
    location: location.trim(),
    duration: duration || '1 Month',
    stipend: stipendType === 'paid' ? String(stipendAmount || '0') : 'Unpaid',
    deadline: deadline || '',
    status,
  })

  const handleSaveDraft = () => {
    setError(null)
    setSaving(true)
    const payload = buildPayload('draft')
    const promise = editId ? internshipService.update(editId, payload) : internshipService.create(payload)
    promise
      .then(() => navigate('/company/internships'))
      .catch(() => setError('Failed to save draft.'))
      .finally(() => setSaving(false))
  }

  const handlePublish = () => {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setError(null)
    setSaving(true)
    const payload = buildPayload('active')
    const promise = editId ? internshipService.update(editId, payload) : internshipService.create(payload)
    promise
      .then(() => navigate('/company/internships'))
      .catch(() => setError('Failed to publish listing.'))
      .finally(() => setSaving(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-slate-gray">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <Link to="/company/internships" className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Manage Internships
        </Link>
      </div>

      <h2 className="text-lg font-semibold text-brand-navy">{editId ? 'Edit Internship' : 'Post New Internship'}</h2>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h3 className="font-medium text-brand-navy">Basic Details</h3>
          <p className="text-xs text-slate-gray">Title, Category, Openings, Description, Roles & Responsibilities, Skills</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Internship Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Web Development Intern" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Category *</label>
              <select value={domain} onChange={(e) => setDomain(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
                <option value="">Select</option>
                <option>Web Dev</option>
                <option>App Dev</option>
                <option>Data Science</option>
                <option>Digital Marketing</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Number of Openings *</label>
              <input type="number" min={1} value={openings} onChange={(e) => setOpenings(Number(e.target.value) || 1)} placeholder="1" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Internship Description *</label>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Min 150 characters..." className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Roles & Responsibilities *</label>
            <textarea rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Bullet points or paragraph..." className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Required Skills (tags)</label>
            <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. HTML, CSS, Python — add as tags" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h3 className="font-medium text-brand-navy">Eligibility</h3>
          <p className="text-xs text-slate-gray">Course, Stream (if B.Tech/Diploma), Semester, Min CGPA</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Eligible Courses *</label>
            <select multiple className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <option>B.Tech</option>
              <option>Diploma</option>
              <option>BCA</option>
              <option>BSc</option>
              <option>BCom</option>
              <option>BBA</option>
              <option>BA</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Eligible Semester</label>
            <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <option value="">All</option>
              <option>3rd</option>
              <option>4th</option>
              <option>5th</option>
              <option>6th</option>
              <option>7th</option>
              <option>8th</option>
              <option>Final Year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Minimum CGPA (0–10)</label>
            <input type="number" min={0} max={10} step={0.1} placeholder="Optional" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h3 className="font-medium text-brand-navy">Type, Location & Duration</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Internship Type *</label>
            <div className="mt-2 flex gap-4">
              {(['onsite', 'remote', 'hybrid'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <input type="radio" name="type" checked={mode === t} onChange={() => setMode(t)} className="text-brand-accent" />
                  <span className="text-sm capitalize">{t}</span>
                </label>
              ))}
            </div>
          </div>
          {(mode === 'onsite' || mode === 'hybrid') && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Location *</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Duration *</label>
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <option value="">Select</option>
              <option>1 Month</option>
              <option>2 Months</option>
              <option>3 Months</option>
              <option>6 Months</option>
              <option>Custom</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h3 className="font-medium text-brand-navy">Stipend & Dates</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Stipend Type *</label>
            <div className="mt-2 flex gap-4">
              {(['paid', 'unpaid'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <input type="radio" name="stipend" checked={stipendType === t} onChange={() => setStipendType(t)} className="text-brand-accent" />
                  <span className="text-sm capitalize">{t}</span>
                </label>
              ))}
            </div>
          </div>
          {stipendType === 'paid' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Stipend Amount (₹/month) *</label>
              <input type="number" min={0} value={stipendAmount} onChange={(e) => setStipendAmount(e.target.value)} placeholder="e.g. 5000" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Application Deadline *</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={handleSaveDraft} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <Save className="h-4 w-4" /> Save as Draft
        </button>
        <button type="button" disabled={saving} onClick={handlePublish} className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
          <Send className="h-4 w-4" /> Publish Now
        </button>
        <Link to="/company/internships" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </Link>
      </div>
    </div>
  )
}
