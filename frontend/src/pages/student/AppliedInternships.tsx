import { Link } from 'react-router-dom'
import { ClipboardList, Briefcase } from 'lucide-react'

/**
 * Student Dashboard — Applied Internships (Part 3A §7).
 * List/table of applications with status pipeline. API integration later.
 */
const SAMPLE_APPLICATIONS = [
  { id: '1', title: 'Web Development Intern', company: 'Tech Solutions Pvt Ltd', appliedOn: '2025-03-01', status: 'Under Review', statusColor: 'bg-blue-100 text-blue-800' },
  { id: '2', title: 'Data Science Intern', company: 'DataCorp India', appliedOn: '2025-02-28', status: 'Shortlisted', statusColor: 'bg-amber-100 text-amber-800' },
]

export function AppliedInternships() {
  return (
    <div className="space-y-6 w-full">
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3 sm:px-6">
          <h2 className="text-lg font-semibold text-brand-navy">Your Applications</h2>
          <p className="mt-0.5 text-sm text-slate-gray">Track status of all internship applications</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Internship</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Applied On</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {SAMPLE_APPLICATIONS.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <ClipboardList className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 font-medium text-gray-600">You haven&apos;t applied to any internships yet.</p>
                    <Link to="/dashboard/internships" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
                      <Briefcase className="h-4 w-4" /> Explore Internships
                    </Link>
                  </td>
                </tr>
              ) : (
                SAMPLE_APPLICATIONS.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-brand-navy">{app.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{app.company}</td>
                    <td className="px-4 py-3 text-sm text-slate-gray">{app.appliedOn}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${app.statusColor}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/dashboard/internships/${app.id}`} className="text-sm font-medium text-brand-accent hover:underline">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
