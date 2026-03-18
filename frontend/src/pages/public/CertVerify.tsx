import { useState, useCallback } from 'react'
import { Search, QrCode, Fingerprint, Database } from 'lucide-react'
import { certificateService } from '@/services/certificateService'

export function CertVerify() {
  const [certId, setCertId] = useState('')
  type VerifyResult =
  | { valid: true; studentName: string; programName: string; university: string; completionDate: string; certificateId: string }
  | { valid: false; message: string }
  | null
  const [result, setResult] = useState<VerifyResult>(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!certId.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await certificateService.verify(certId)
      setResult(res)
    } catch {
      setResult({ valid: false, message: 'Verification failed. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    // TODO: parse QR from dropped file and verify
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const features = [
    {
      icon: QrCode,
      title: 'QR Code',
      desc: 'Every certificate has a unique scannable QR code',
    },
    {
      icon: Fingerprint,
      title: 'Unique ID',
      desc: 'Each certificate has a unique verifiable ID',
    },
    {
      icon: Database,
      title: 'Database Backed',
      desc: 'All certificates stored securely in our database',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-100/80 min-w-0">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14 lg:py-16">
        {/* Main verification card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-accent/10">
              <div className="h-12 w-12 rounded-full bg-brand-accent" />
            </div>
            <h1 className="mt-5 text-2xl font-bold text-brand-navy sm:text-3xl">
              Certificate Verification
            </h1>
            <p className="mt-2 max-w-md text-sm text-gray-600 sm:text-base">
              Enter the Certificate ID or scan the QR code to verify the authenticity of an XpertIntern certificate.
            </p>
          </div>

          <form onSubmit={handleVerify} className="mt-8 space-y-6">
            <div>
              <input
                type="text"
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
                placeholder="ENTER CERTIFICATE ID (E.G. XI-2026-001)"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm uppercase placeholder:normal-case placeholder:text-gray-500 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Or</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragOver ? 'border-brand-accent bg-brand-light-bg/50' : 'border-gray-300 bg-gray-50/50'
              }`}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gray-200">
                <QrCode className="h-6 w-6 text-gray-500" />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-700">Upload QR Code Image</p>
              <p className="mt-1 text-xs text-gray-500">
                Click to upload or drag & drop the certificate QR code
              </p>
              <input
                type="file"
                accept="image/*"
                className="mt-3 hidden"
                id="qr-upload"
                onChange={() => {}}
              />
              <label
                htmlFor="qr-upload"
                className="mt-2 inline-block cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Choose file
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent py-3 text-sm font-semibold text-white hover:bg-primary-600 transition disabled:opacity-70"
            >
              <Search className="h-4 w-4" /> {loading ? 'Verifying...' : 'Verify Certificate'}
            </button>
          </form>

          {result && (
            <div
              className={`mt-6 rounded-xl border p-4 sm:p-6 ${
                result.valid ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              {result.valid ? (
                <>
                  <div className="flex items-center gap-2 text-green-800">
                    <span className="inline-flex items-center rounded-full bg-green-200 px-2.5 py-0.5 text-sm font-semibold">Valid</span>
                    <span className="font-medium">Certificate verified successfully</span>
                  </div>
                  <dl className="mt-4 grid gap-2 sm:grid-cols-2 text-sm">
                    <div><dt className="text-gray-500">Student Name</dt><dd className="font-medium text-gray-900">{result.studentName}</dd></div>
                    <div><dt className="text-gray-500">Program / Course</dt><dd className="font-medium text-gray-900">{result.programName}</dd></div>
                    <div><dt className="text-gray-500">University / Board</dt><dd className="font-medium text-gray-900">{result.university}</dd></div>
                    <div><dt className="text-gray-500">Completion Date</dt><dd className="font-medium text-gray-900">{result.completionDate}</dd></div>
                    <div><dt className="text-gray-500">Certificate ID</dt><dd className="font-medium text-gray-900">{result.certificateId}</dd></div>
                    <div><dt className="text-gray-500">Verification Status</dt><dd><span className="font-semibold text-green-700">Valid</span></dd></div>
                  </dl>
                  <button
                    type="button"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 transition"
                  >
                    Download Certificate
                  </button>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-900">Verification result</p>
                  <p className="mt-1 text-sm text-gray-600">{result.message}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Feature cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light-bg">
                <Icon className="h-5 w-5 text-brand-accent" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-brand-navy">{title}</h3>
              <p className="mt-1 text-xs text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
