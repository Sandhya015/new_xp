import { useEffect, useState } from 'react'
import { Award, Download, Upload } from 'lucide-react'
import { adminService } from '@/services/adminService'

/**
 * Admin — Certificate Generation. Part 5A §6. By Batch + By Excel upload, certificate register.
 */
export function CertificateUpload() {
  const [activeTab, setActiveTab] = useState<'batch' | 'excel' | 'register'>('batch')
  const [trainings, setTrainings] = useState<Array<{ id: string; title: string }>>([])
  const [certificates, setCertificates] = useState<Array<{ id: string; certNo: string; studentName: string; programName: string; issueDate: string; university: string; status: string }>>([])
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerSearch, setRegisterSearch] = useState('')
  const [registerStatus, setRegisterStatus] = useState('')

  useEffect(() => {
    if (activeTab === 'batch') {
      adminService.getCertificateTrainings().then((r) => setTrainings(r.items || [])).catch(() => setTrainings([]))
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'register') {
      setRegisterLoading(true)
      adminService.getCertificates({ search: registerSearch || undefined, status: registerStatus || undefined })
        .then((r) => setCertificates(r.items || []))
        .catch(() => setCertificates([]))
        .finally(() => setRegisterLoading(false))
    }
  }, [activeTab, registerSearch, registerStatus])

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-lg font-semibold text-brand-navy">Certificate Generation</h2>

      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('batch')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'batch' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Generate by Batch
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'excel' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Generate by Excel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'register' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-slate-gray hover:text-brand-navy'
          }`}
        >
          Certificate Register
        </button>
      </div>

      {activeTab === 'batch' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <h3 className="font-semibold text-brand-navy">Generate by Batch</h3>
          <p className="text-sm text-slate-gray">Select Training Program → Batch → Students → Certificate details → Generate. Unique Certificate ID + QR per certificate.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Training Program *</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                <option value="">Select program</option>
                {trainings.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Batch *</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                <option value="">Select batch</option>
              </select>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Student Selection (checkbox / Select All)</h4>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left"><input type="checkbox" className="rounded text-brand-accent" title="Select All" /></th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Reg. No.</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">University</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-gray">Select program and batch to load students.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Certificate Type</label>
              <input type="text" placeholder="e.g. Training Completion" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Issue Date</label>
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Duration</label>
              <input type="text" placeholder="e.g. 4 Weeks" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mode</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option>Online</option><option>Offline</option><option>Hybrid</option></select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Template</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Default</option></select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Signatory</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Default</option></select>
            </div>
          </div>
          <button type="button" className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
            Generate Certificates
          </button>
        </div>
      )}

      {activeTab === 'excel' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <h3 className="font-semibold text-brand-navy">Generate by Excel Upload</h3>
          <p className="text-sm text-slate-gray">Download template (Student Name, Father&apos;s Name, College, University, Course, Branch, Semester, Reg No., Email, Mobile). Fill and upload. Max 10MB. Validation → Preview → Certificate details → Generate.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Download className="h-4 w-4" /> Download Excel Template
            </button>
            <label className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 cursor-pointer">
              <Upload className="h-4 w-4" /> Upload Filled Excel
              <input type="file" accept=".xlsx,.xls" className="hidden" />
            </label>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Validation Preview</h4>
            <p className="text-xs text-slate-gray mb-2">Valid rows in green, invalid in red with error reason. Option to skip invalid rows and proceed with valid only.</p>
            <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-gray">Upload file to see validation results.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'register' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-brand-navy">Certificate Register</h3>
          <p className="text-sm text-slate-gray">Search by Certificate ID, student name, or registration number. Revoke (reason required) or Re-issue (new cert, old revoked).</p>
          <div className="flex flex-wrap gap-2">
            <input type="search" value={registerSearch} onChange={(e) => setRegisterSearch(e.target.value)} placeholder="Search by Certificate ID, Student Name..." className="min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <select value={registerStatus} onChange={(e) => setRegisterStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <option value="">All Status</option>
              <option value="valid">Valid</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Certificate ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Student Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Program / Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Issue Date</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">University</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {registerLoading ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-gray">Loading…</td></tr>
                ) : certificates.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-gray"><Award className="mx-auto h-10 w-10 text-gray-300" /><p className="mt-2">No records.</p></td></tr>
                ) : (
                  certificates.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{c.certNo}</td>
                      <td className="px-3 py-2">{c.studentName}</td>
                      <td className="px-3 py-2">{c.programName}</td>
                      <td className="px-3 py-2">{c.issueDate}</td>
                      <td className="px-3 py-2">{c.university}</td>
                      <td className="px-3 py-2">{c.status}</td>
                      <td className="px-3 py-2 text-right">View · Download · Revoke · Re-issue</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-gray">Actions: View, Download, Revoke (reason), Re-issue (opens form with existing data; new Certificate ID generated).</p>
        </div>
      )}
    </div>
  )
}
