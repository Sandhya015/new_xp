/**
 * Admin — Manage Existing Training (AD-WF-04). Tabs: Overview, Batches, Class Links, Materials, Assignments, Quizzes, Attendance, Announcements, Enrolled Students.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Link2,
  FileText,
  ClipboardList,
  HelpCircle,
  UserCheck,
  Users,
  Plus,
  Download,
  Send,
  Trash2,
  Pencil,
} from 'lucide-react'
import { adminService } from '@/services/adminService'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'batches', label: 'Batches', icon: Calendar },
  { id: 'class-links', label: 'Class Links', icon: Link2 },
  { id: 'materials', label: 'Study Materials', icon: FileText },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
  { id: 'quizzes', label: 'Quizzes', icon: HelpCircle },
  { id: 'attendance', label: 'Attendance', icon: UserCheck },
  { id: 'announcements', label: 'Announcements', icon: Send },
  { id: 'enrolled', label: 'Enrolled Students', icon: Users },
] as const

type CourseDetail = {
  id: string
  title: string
  description: string
  shortDescription?: string
  fullDescription?: string
  category?: string
  duration?: string
  durationValue?: string
  durationUnit?: string
  mode?: string
  universities?: string
  price?: number
  tag?: string
  active?: boolean
  trainerName?: string
  courses?: string[]
  streams?: string[]
  batches?: Array<{ name: string; startDate: string; endDate: string; maxSeats: string; mode: string }>
  curriculum?: unknown[]
  classLinks?: Array<{ id?: string; title: string; date: string; time: string; platform: string; link: string; batch: string }>
  studyMaterials?: Array<{ id?: string; title: string; module: string; type: string; url: string }>
  assignments?: Array<{ id?: string; title: string; dueDate: string; description: string }>
  quizzes?: Array<{ id?: string; title: string; dueDate: string }>
  announcements?: Array<{ id?: string; title: string; message: string; createdAt?: string }>
}

export function ManageTraining() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('overview')
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enrollments, setEnrollments] = useState<Array<{ id: string; name: string; email: string; mobile: string; university: string; collegeName: string; course: string; stream: string; semester: string; enrolledAt: string; batch: string }>>([])
  const [enrollLoading, setEnrollLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    adminService.getCourse(id).then(setCourse).catch(() => setCourse(null)).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (id && activeTab === 'enrolled') {
      setEnrollLoading(true)
      adminService.getCourseEnrollments(id).then((r) => setEnrollments(r.items || [])).catch(() => setEnrollments([])).finally(() => setEnrollLoading(false))
    }
  }, [id, activeTab])

  const updateCourseSection = async (section: keyof CourseDetail, value: unknown) => {
    if (!id || !course) return
    setSaving(true)
    setError(null)
    try {
      const updated = await adminService.updateCourse(id, { [section]: value })
      setCourse(updated)
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response
        ? String((e.response as { data?: { error?: string } }).data?.error ?? 'Update failed')
        : 'Update failed'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const addBatch = () => {
    const batches = [...(course?.batches || []), { name: '', startDate: '', endDate: '', maxSeats: '', mode: 'Online' }]
    updateCourseSection('batches', batches)
  }
  const removeBatch = (index: number) => {
    const batches = (course?.batches || []).filter((_, i) => i !== index)
    updateCourseSection('batches', batches)
  }
  const updateBatch = (index: number, field: string, value: string) => {
    const batches = (course?.batches || []).map((b, i) => (i === index ? { ...b, [field]: value } : b))
    updateCourseSection('batches', batches)
  }

  const addClassLink = (link: { title: string; date: string; time: string; platform: string; link: string; batch: string }) => {
    const classLinks = [...(course?.classLinks || []), { ...link, id: `cl_${Date.now()}` }]
    updateCourseSection('classLinks', classLinks)
  }
  const removeClassLink = (index: number) => {
    const classLinks = (course?.classLinks || []).filter((_, i) => i !== index)
    updateCourseSection('classLinks', classLinks)
  }

  const addMaterial = (m: { title: string; module: string; type: string; url: string }) => {
    const studyMaterials = [...(course?.studyMaterials || []), { ...m, id: `sm_${Date.now()}` }]
    updateCourseSection('studyMaterials', studyMaterials)
  }
  const removeMaterial = (index: number) => {
    const studyMaterials = (course?.studyMaterials || []).filter((_, i) => i !== index)
    updateCourseSection('studyMaterials', studyMaterials)
  }

  const addAssignment = (a: { title: string; dueDate: string; description: string }) => {
    const assignments = [...(course?.assignments || []), { ...a, id: `a_${Date.now()}` }]
    updateCourseSection('assignments', assignments)
  }
  const removeAssignment = (index: number) => {
    const assignments = (course?.assignments || []).filter((_, i) => i !== index)
    updateCourseSection('assignments', assignments)
  }

  const addQuiz = (q: { title: string; dueDate: string }) => {
    const quizzes = [...(course?.quizzes || []), { ...q, id: `q_${Date.now()}` }]
    updateCourseSection('quizzes', quizzes)
  }
  const removeQuiz = (index: number) => {
    const quizzes = (course?.quizzes || []).filter((_, i) => i !== index)
    updateCourseSection('quizzes', quizzes)
  }

  const addAnnouncement = (a: { title: string; message: string }) => {
    const announcements = [...(course?.announcements || []), { ...a, id: `an_${Date.now()}`, createdAt: new Date().toISOString() }]
    updateCourseSection('announcements', announcements)
  }
  const removeAnnouncement = (index: number) => {
    const announcements = (course?.announcements || []).filter((_, i) => i !== index)
    updateCourseSection('announcements', announcements)
  }

  if (loading) return <div className="p-6 text-slate-gray">Loading training…</div>
  if (!course) return <div className="p-6 text-red-600">Training not found.</div>

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Link to="/admin/courses" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-brand-navy truncate">{course.title || 'Manage Training'}</h2>
          <p className="text-sm text-slate-gray">Edit content, batches, class links, materials, quizzes, attendance, and announcements.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.id ? 'border-brand-accent text-brand-accent bg-white' : 'border-transparent text-slate-gray hover:text-brand-navy hover:bg-gray-50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Link
                to={`/admin/courses/${id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-4 w-4" /> Edit Training Details
              </Link>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <dt className="text-slate-500">Title</dt><dd className="font-medium">{course.title}</dd>
              <dt className="text-slate-500">Category</dt><dd>{course.category || '—'}</dd>
              <dt className="text-slate-500">Duration</dt><dd>{course.duration || course.durationValue ? `${course.durationValue || ''} ${course.durationUnit || ''}` : '—'}</dd>
              <dt className="text-slate-500">Mode</dt><dd>{course.mode || '—'}</dd>
              <dt className="text-slate-500">Fee (₹)</dt><dd>{course.price ?? '—'}</dd>
              <dt className="text-slate-500">Trainer</dt><dd>{course.trainerName || '—'}</dd>
              <dt className="text-slate-500">Universities</dt><dd>{course.universities || '—'}</dd>
              <dt className="text-slate-500">Status</dt><dd>{course.active ? 'Active' : 'Draft'}</dd>
            </dl>
            {(course.shortDescription || course.description) && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</h4>
                <p className="text-sm text-gray-700">{course.shortDescription || course.description}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-200">
              <span className="text-sm text-slate-500">Batches: {(course.batches || []).length}</span>
              <span className="text-sm text-slate-500">Curriculum modules: {(course.curriculum || []).length}</span>
              <span className="text-sm text-slate-500">Class links: {(course.classLinks || []).length}</span>
              <span className="text-sm text-slate-500">Materials: {(course.studyMaterials || []).length}</span>
            </div>
          </div>
        )}

        {activeTab === 'batches' && (
          <div className="space-y-4">
            <button type="button" onClick={addBatch} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Add Batch
            </button>
            {(course.batches || []).length === 0 ? (
              <p className="text-sm text-slate-gray">No batches. Add one above.</p>
            ) : (
              <ul className="space-y-3">
                {(course.batches || []).map((batch, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-3">
                    <input value={batch.name} onChange={(e) => updateBatch(i, 'name', e.target.value)} placeholder="Batch name" className="rounded border border-gray-300 px-2 py-1.5 text-sm w-32" />
                    <input type="date" value={batch.startDate} onChange={(e) => updateBatch(i, 'startDate', e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
                    <input type="date" value={batch.endDate} onChange={(e) => updateBatch(i, 'endDate', e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
                    <input type="number" min={1} value={batch.maxSeats} onChange={(e) => updateBatch(i, 'maxSeats', e.target.value)} placeholder="Seats" className="rounded border border-gray-300 px-2 py-1.5 text-sm w-20" />
                    <select value={batch.mode} onChange={(e) => updateBatch(i, 'mode', e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
                      <option>Online</option><option>Offline</option><option>Hybrid</option>
                    </select>
                    <button type="button" onClick={() => removeBatch(i)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'class-links' && (
          <ClassLinksTab classLinks={course.classLinks || []} onAdd={addClassLink} onRemove={removeClassLink} saving={saving} batches={course.batches || []} />
        )}

        {activeTab === 'materials' && (
          <MaterialsTab materials={course.studyMaterials || []} onAdd={addMaterial} onRemove={removeMaterial} saving={saving} />
        )}

        {activeTab === 'assignments' && (
          <AssignmentsTab assignments={course.assignments || []} onAdd={addAssignment} onRemove={removeAssignment} saving={saving} />
        )}

        {activeTab === 'quizzes' && (
          <QuizzesTab quizzes={course.quizzes || []} onAdd={addQuiz} onRemove={removeQuiz} saving={saving} />
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-gray">Select batch and session date. Mark Present/Absent per student or upload Excel. Save Attendance.</p>
            <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center text-slate-500 text-sm">Attendance feature — API integration pending.</div>
          </div>
        )}

        {activeTab === 'announcements' && (
          <AnnouncementsTab announcements={course.announcements || []} onAdd={addAnnouncement} onRemove={removeAnnouncement} saving={saving} />
        )}

        {activeTab === 'enrolled' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">All Batches</option>
                {(course.batches || []).map((b, i) => (
                  <option key={i} value={b.name}>{b.name || `Batch ${i + 1}`}</option>
                ))}
              </select>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Download className="h-4 w-4" /> Download (Excel)
              </button>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
                <Send className="h-4 w-4" /> Send Notification
              </button>
            </div>
            {enrollLoading ? (
              <p className="text-sm text-slate-gray">Loading enrollments…</p>
            ) : enrollments.length === 0 ? (
              <p className="text-sm text-slate-gray">No enrolled students yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Mobile</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">University</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">College</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {enrollments.map((e) => (
                      <tr key={e.id}>
                        <td className="px-3 py-2">{e.name || '—'}</td>
                        <td className="px-3 py-2">{e.email}</td>
                        <td className="px-3 py-2">{e.mobile || '—'}</td>
                        <td className="px-3 py-2">{e.university || '—'}</td>
                        <td className="px-3 py-2">{e.collegeName || '—'}</td>
                        <td className="px-3 py-2">{e.enrolledAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ClassLinksTab({
  classLinks,
  onAdd,
  onRemove,
  saving,
  batches,
}: {
  classLinks: Array<{ title: string; date: string; time: string; platform: string; link: string; batch: string }>
  onAdd: (l: { title: string; date: string; time: string; platform: string; link: string; batch: string }) => void
  onRemove: (i: number) => void
  saving: boolean
  batches: Array<{ name: string }>
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [platform, setPlatform] = useState('Zoom')
  const [link, setLink] = useState('')
  const [batch, setBatch] = useState('')
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), date, time, platform, link: link.trim(), batch })
    setTitle(''); setDate(''); setTime(''); setLink('')
  }
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session title" className="rounded border border-gray-300 px-2 py-1.5 text-sm w-40" required />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
          <option>Zoom</option><option>Meet</option><option>Teams</option>
        </select>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Meeting link" className="rounded border border-gray-300 px-2 py-1.5 text-sm min-w-[200px]" />
        <select value={batch} onChange={(e) => setBatch(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">Batch</option>
          {batches.map((b, i) => (
            <option key={i} value={b.name}>{b.name || `Batch ${i + 1}`}</option>
          ))}
        </select>
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Add</button>
      </form>
      <p className="text-xs text-slate-500">Session Title, Date, Time, Platform, Meeting Link, Batch. Notify students optionally.</p>
      {classLinks.length === 0 ? (
        <p className="text-sm text-slate-gray">No class links yet.</p>
      ) : (
        <ul className="space-y-2">
          {classLinks.map((l, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-2">
              <span className="font-medium">{l.title}</span> <span className="text-slate-500 text-xs">{l.date} {l.time} · {l.platform}</span>
              <a href={l.link} target="_blank" rel="noopener noreferrer" className="text-brand-accent text-sm truncate max-w-[180px]">{l.link || '—'}</a>
              <button type="button" onClick={() => onRemove(i)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MaterialsTab({
  materials,
  onAdd,
  onRemove,
  saving,
}: {
  materials: Array<{ title: string; module: string; type: string; url: string }>
  onAdd: (m: { title: string; module: string; type: string; url: string }) => void
  onRemove: (i: number) => void
  saving: boolean
}) {
  const [title, setTitle] = useState('')
  const [module, setModule] = useState('')
  const [type, setType] = useState('PDF')
  const [url, setUrl] = useState('')
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), module: module.trim(), type, url: url.trim() })
    setTitle(''); setModule(''); setUrl('')
  }
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded border border-gray-300 px-2 py-1.5 text-sm w-40" required />
        <input value={module} onChange={(e) => setModule(e.target.value)} placeholder="Module" className="rounded border border-gray-300 px-2 py-1.5 text-sm w-32" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
          <option>PDF</option><option>PPT</option><option>DOC</option><option>Video</option>
        </select>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL or file path" className="rounded border border-gray-300 px-2 py-1.5 text-sm min-w-[220px]" />
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Add</button>
      </form>
      {materials.length === 0 ? (
        <p className="text-sm text-slate-gray">No materials yet.</p>
      ) : (
        <ul className="space-y-2">
          {materials.map((m, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-2">
              <span className="font-medium">{m.title}</span> <span className="text-slate-500 text-xs">{m.type} · {m.module}</span>
              <button type="button" onClick={() => onRemove(i)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AssignmentsTab({
  assignments,
  onAdd,
  onRemove,
  saving,
}: {
  assignments: Array<{ title: string; dueDate: string; description: string }>
  onAdd: (a: { title: string; dueDate: string; description: string }) => void
  onRemove: (i: number) => void
  saving: boolean
}) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), dueDate, description: description.trim() })
    setTitle(''); setDueDate(''); setDescription('')
  }
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2 max-w-md">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" required />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Add Assignment</button>
      </form>
      {assignments.length === 0 ? (
        <p className="text-sm text-slate-gray">No assignments yet.</p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-2">
              <div><span className="font-medium">{a.title}</span> {a.dueDate && <span className="text-slate-500 text-xs">Due {a.dueDate}</span>}</div>
              <button type="button" onClick={() => onRemove(i)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function QuizzesTab({
  quizzes,
  onAdd,
  onRemove,
  saving,
}: {
  quizzes: Array<{ title: string; dueDate: string }>
  onAdd: (q: { title: string; dueDate: string }) => void
  onRemove: (i: number) => void
  saving: boolean
}) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), dueDate })
    setTitle(''); setDueDate('')
  }
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz title" className="rounded border border-gray-300 px-2 py-1.5 text-sm w-48" required />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Add Quiz</button>
      </form>
      {quizzes.length === 0 ? (
        <p className="text-sm text-slate-gray">No quizzes yet.</p>
      ) : (
        <ul className="space-y-2">
          {quizzes.map((q, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-2">
              <span className="font-medium">{q.title}</span> {q.dueDate && <span className="text-slate-500 text-xs">Due {q.dueDate}</span>}
              <button type="button" onClick={() => onRemove(i)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AnnouncementsTab({
  announcements,
  onAdd,
  onRemove,
  saving,
}: {
  announcements: Array<{ title: string; message: string; createdAt?: string }>
  onAdd: (a: { title: string; message: string }) => void
  onRemove: (i: number) => void
  saving: boolean
}) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return
    onAdd({ title: title.trim(), message: message.trim() })
    setTitle(''); setMessage('')
  }
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2 max-w-md">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" required />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" required />
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white">Post Announcement</button>
      </form>
      <p className="text-xs text-slate-500">All enrolled students can be notified (in-app + email when API is ready).</p>
      {announcements.length === 0 ? (
        <p className="text-sm text-slate-gray">No announcements yet.</p>
      ) : (
        <ul className="space-y-2">
          {announcements.map((a, i) => (
            <li key={i} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div><h4 className="font-medium">{a.title}</h4><p className="text-sm text-slate-600 mt-0.5">{a.message}</p></div>
                <button type="button" onClick={() => onRemove(i)} className="p-1 text-red-600 hover:bg-red-50 rounded shrink-0"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
