import { useState } from 'react'
import { Award, Download, Upload } from 'lucide-react'

/**
 * Admin — Certificate Generation. Part 5A §6. By Batch + By Excel upload, certificate register.
 */
export function CertificateUpload() {
  const [activeTab, setActiveTab] = useState<'batch' | 'excel' | 'register'>('batch')

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
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-brand-navy">Generate by Batch</h3>
          <p className="mt-1 text-sm text-slate-gray">Select Training Program → Batch → Students → Certificate details → Generate. Unique Certificate ID + QR per certificate.</p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Training Program *</label>
              <select className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                <option value="">Select program</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Batch *</label>
              <select className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                <option value="">Select batch</option>
              </select>
            </div>
            <p className="text-sm text-slate-gray">Student selection table and certificate details form will appear here (API wiring later).</p>
            <button type="button" className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
              Generate Certificates
            </button>
          </div>
        </div>
      )}

      {activeTab === 'excel' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-brand-navy">Generate by Excel Upload</h3>
          <p className="mt-1 text-sm text-slate-gray">Download template, fill student data, upload. Validation → Preview → Certificate details → Generate.</p>
          <div className="mt-4 flex gap-3">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Download className="h-4 w-4" /> Download Excel Template
            </button>
            <label className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 cursor-pointer">
              <Upload className="h-4 w-4" /> Upload Filled Excel
              <input type="file" accept=".xlsx,.xls" className="hidden" />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'register' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-brand-navy">Certificate Register</h3>
          <p className="mt-1 text-sm text-slate-gray">Searchable table: Certificate ID, Student Name, Program/Type, Issue Date, University, Status (Valid/Revoked). View, Download, Revoke, Re-issue.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input type="search" placeholder="Search by Certificate ID, Student Name..." className="min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <option value="">All Status</option>
              <option>Valid</option>
              <option>Revoked</option>
            </select>
          </div>
          <div className="mt-4 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12 text-center text-slate-gray text-sm">
            <Award className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-2">Certificate records table will load from API.</p>
          </div>
        </div>
      )}
    </div>
  )
}
