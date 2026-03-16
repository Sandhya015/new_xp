import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Play, CheckCircle, Award } from 'lucide-react'

/**
 * Student Dashboard — My Enrolled Courses (Part 3A §6). Ongoing / Completed tabs.
 */
export function MyCourses() {
  const [tab, setTab] = useState<'ongoing' | 'completed'>('ongoing')

  const ongoing = [
    { id: '1', name: 'Web Development', university: 'BEU', mode: 'Online', startDate: 'Jan 2025', duration: '4 Weeks', progress: 65 },
    { id: '2', name: 'Python Programming', university: 'AKTU', mode: 'Hybrid', startDate: 'Feb 2025', duration: '6 Weeks', progress: 30 },
  ]
  const completed = [
    { id: '3', name: 'Digital Marketing', university: 'BEU', completionDate: 'Dec 2024', grade: 'A' },
  ]

  return (
    <div className="space-y-6 w-full">
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab('ongoing')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            tab === 'ongoing'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Ongoing
        </button>
        <button
          type="button"
          onClick={() => setTab('completed')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            tab === 'completed'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Completed
        </button>
      </div>

      {tab === 'ongoing' && (
        <>
          {ongoing.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 font-medium text-gray-600">You haven&apos;t enrolled in any training yet.</p>
              <Link to="/dashboard/training" className="mt-3 inline-block rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
                Explore Training
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {ongoing.map((c) => (
                <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-brand-navy">{c.name}</h3>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{c.mode}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-gray">{c.university} · Started {c.startDate} · {c.duration}</p>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-gray">
                      <span>Progress</span>
                      <span>{c.progress}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand-accent" style={{ width: `${c.progress}%` }} />
                    </div>
                  </div>
                  <Link
                    to={`/dashboard/my-courses/${c.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600"
                  >
                    <Play className="h-4 w-4" /> Continue
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'completed' && (
        <>
          {completed.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 font-medium text-gray-600">No completed trainings yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {completed.map((c) => (
                <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-brand-navy">{c.name}</h3>
                    {c.grade && <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{c.grade}</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-gray">{c.university} · Completed {c.completionDate}</p>
                  <div className="mt-4 flex gap-2">
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      View Details
                    </button>
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600">
                      <Award className="h-4 w-4" /> Download Certificate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
