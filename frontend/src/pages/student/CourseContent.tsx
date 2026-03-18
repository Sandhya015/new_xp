/**
 * Student Dashboard — View Enrolled Course Content (SD-WF-10).
 * Tabs: Overview, Curriculum, Class Links, Study Materials, Assignments, Quizzes, Announcements, Certificate.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  BookOpen,
  ListOrdered,
  Link2,
  FileText,
  ClipboardList,
  HelpCircle,
  Send,
  Award,
  ArrowLeft,
  ExternalLink,
  Download,
} from 'lucide-react'
import { courseService, type CourseContent } from '@/services/courseService'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'curriculum', label: 'Curriculum', icon: ListOrdered },
  { id: 'class-links', label: 'Class Links', icon: Link2 },
  { id: 'materials', label: 'Study Materials', icon: FileText },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
  { id: 'quizzes', label: 'Quizzes', icon: HelpCircle },
  { id: 'announcements', label: 'Announcements', icon: Send },
  { id: 'certificate', label: 'Certificate', icon: Award },
] as const

export function CourseContent() {
  const { id: courseId } = useParams<{ id: string }>()
  const [course, setCourse] = useState<CourseContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('overview')

  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    setError(null)
    courseService
      .getContent(courseId)
      .then(setCourse)
      .catch(() => {
        setCourse(null)
        setError('Unable to load course content.')
      })
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-slate-gray">Loading course...</p>
      </div>
    )
  }
  if (error || !course) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-red-600">{error || 'Course not found.'}</p>
        <Link to="/dashboard/my-courses" className="mt-4 inline-block text-brand-accent font-semibold hover:underline">
          ← Back to My Courses
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/dashboard/my-courses"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Courses
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-brand-navy">{course.title}</h1>
      {course.trainerName && (
        <p className="mt-1 text-sm text-slate-gray">Trainer: {course.trainerName}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'border-b-2 border-brand-accent bg-white text-brand-accent'
                : 'text-slate-gray hover:bg-gray-50 hover:text-brand-navy'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-b-xl border border-t-0 border-gray-200 bg-white p-6 shadow-sm">
        {activeTab === 'overview' && (
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700">{course.fullDescription || course.description || 'No description.'}</p>
            <ul className="mt-4 list-inside list-disc text-gray-600">
              {course.duration && <li>Duration: {course.duration}</li>}
              {course.mode && <li>Mode: {course.mode}</li>}
              {course.universities && <li>Universities: {course.universities}</li>}
            </ul>
          </div>
        )}
        {activeTab === 'curriculum' && (
          <div className="space-y-4">
            {(!course.curriculum || course.curriculum.length === 0) ? (
              <p className="text-slate-gray">No curriculum added yet.</p>
            ) : (
              (course.curriculum as Array<{ name?: string; topics?: string[] }>).map((mod, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-3">
                  <h4 className="font-semibold text-brand-navy">{mod.name || `Module ${i + 1}`}</h4>
                  {mod.topics && mod.topics.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-sm text-gray-600">
                      {mod.topics.map((t, j) => (
                        <li key={j}>{typeof t === 'string' ? t : (t as { title?: string })?.title || 'Topic'}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'class-links' && (
          <div className="space-y-3">
            {(!course.classLinks || course.classLinks.length === 0) ? (
              <p className="text-slate-gray">No class links yet.</p>
            ) : (
              course.classLinks.map((cl, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <p className="font-medium text-gray-800">{cl.title || 'Session'}</p>
                    <p className="text-xs text-slate-gray">{cl.date} {cl.time} · {cl.platform}</p>
                  </div>
                  {cl.link && (
                    <a
                      href={cl.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
                    >
                      Join <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'materials' && (
          <div className="space-y-3">
            {(!course.studyMaterials || course.studyMaterials.length === 0) ? (
              <p className="text-slate-gray">No study materials yet.</p>
            ) : (
              course.studyMaterials.map((m, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <p className="font-medium text-gray-800">{m.title}</p>
                    <p className="text-xs text-slate-gray">{m.module} · {m.type}</p>
                  </div>
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" /> Download
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'assignments' && (
          <div className="space-y-3">
            {(!course.assignments || course.assignments.length === 0) ? (
              <p className="text-slate-gray">No assignments yet.</p>
            ) : (
              course.assignments.map((a, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-3">
                  <p className="font-medium text-gray-800">{a.title}</p>
                  {a.dueDate && <p className="text-xs text-slate-gray">Due: {a.dueDate}</p>}
                  {a.description && <p className="mt-1 text-sm text-gray-600">{a.description}</p>}
                  <button type="button" className="mt-2 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                    Upload Submission
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'quizzes' && (
          <div className="space-y-3">
            {(!course.quizzes || course.quizzes.length === 0) ? (
              <p className="text-slate-gray">No quizzes yet.</p>
            ) : (
              course.quizzes.map((q, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <p className="font-medium text-gray-800">{q.title}</p>
                    {q.dueDate && <p className="text-xs text-slate-gray">Due: {q.dueDate}</p>}
                  </div>
                  <button type="button" className="rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600">
                    Start Quiz
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'announcements' && (
          <div className="space-y-3">
            {(!course.announcements || course.announcements.length === 0) ? (
              <p className="text-slate-gray">No announcements yet.</p>
            ) : (
              course.announcements.map((a, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-3">
                  <p className="font-medium text-gray-800">{a.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{a.message}</p>
                  {a.createdAt && <p className="mt-1 text-xs text-slate-gray">{a.createdAt}</p>}
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'certificate' && (
          <div className="rounded-lg border border-gray-100 p-6 text-center">
            <Award className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 font-medium text-gray-700">Certificate will be issued on course completion.</p>
            <Link to="/dashboard/certificates" className="mt-3 inline-block text-brand-accent font-semibold hover:underline">
              View My Certificates
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
