import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Search, Download, CheckCircle2, XCircle, QrCode } from 'lucide-react'
import { certificateService, type VerifyResult } from '@/services/certificateService'
import { showAppToast } from '@/components/AppToastHost'

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value || !value.trim()) return null
  return (
    <div className="border-b border-gray-100 py-2.5 sm:grid sm:grid-cols-2 sm:gap-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

export function CertVerify() {
  const { certNo: certNoParam } = useParams<{ certNo?: string }>()
  const [searchParams] = useSearchParams()
  const [certId, setCertId] = useState('')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const fromPath = (certNoParam || '').trim()
    const fromQuery = (searchParams.get('cert') || searchParams.get('id') || '').trim()
    const initial = fromPath || fromQuery
    if (initial) setCertId(initial)
  }, [certNoParam, searchParams])

  const runVerify = useCallback(async (raw: string) => {
    const id = raw.trim()
    if (!id) return
    setLoading(true)
    setResult(null)
    try {
      const res = await certificateService.verify(id)
      setResult(res)
    } catch {
      setResult({
        status: false,
        valid: false,
        message: 'Verification failed. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const fromPath = (certNoParam || '').trim()
    const fromQuery = (searchParams.get('cert') || searchParams.get('id') || '').trim()
    const auto = fromPath || fromQuery
    if (auto) void runVerify(auto)
  }, [certNoParam, searchParams, runVerify])

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    void runVerify(certId)
  }

  const handleDownload = async () => {
    if (!result || !result.valid) return
    const no = result.certificate_no || certId
    setDownloading(true)
    try {
      const blob = await certificateService.downloadVerifiedPdf(no)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `XpertIntern-${no.replace(/[^\w-]+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      showAppToast(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const qrHint =
    typeof window !== 'undefined' && certNoParam
      ? `${window.location.origin}/verify/${encodeURIComponent(certNoParam)}`
      : ''

  return (
    <div className="min-h-screen bg-gray-100/80 min-w-0">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent/10">
              <CheckCircle2 className="h-8 w-8 text-brand-accent" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-brand-navy sm:text-3xl">Certificate Verification</h1>
            <p className="mt-2 text-sm text-gray-600">
              Enter an internship certificate number or open a QR link (e.g.{' '}
              <code className="rounded bg-gray-100 px-1 text-xs">/verify/XPT2026WD000001</code>) to verify authenticity.
            </p>
          </div>

          <form onSubmit={handleVerify} className="mt-8 space-y-4">
            <label htmlFor="cert-no" className="block text-sm font-medium text-gray-700">
              Certificate Number
            </label>
            <input
              id="cert-no"
              type="text"
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              placeholder="e.g. XPT2026WD000001"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm uppercase placeholder:normal-case focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
            />
            <button
              type="submit"
              disabled={loading || !certId.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>

          {qrHint ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-brand-light-bg/60 px-3 py-2 text-xs text-gray-600">
              <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
              QR verification URL: <span className="break-all font-mono">{qrHint}</span>
            </p>
          ) : null}

          {result && (
            <div className="mt-8">
              {result.valid ? (
                <div className="rounded-xl border border-green-200 bg-green-50/80 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">Certificate verified successfully</span>
                  </div>
                  <dl className="mt-4 divide-y divide-green-100/80 rounded-lg bg-white/60 px-4">
                    <DetailRow label="Certificate Number" value={result.certificate_no} />
                    <DetailRow label="Name" value={result.name} />
                    <DetailRow label="College Name" value={result.college_name} />
                    <DetailRow label="Course" value={result.course} />
                    <DetailRow label="Branch" value={result.branch} />
                    <DetailRow label="Semester" value={result.semester} />
                    <DetailRow label="Registration Number" value={result.registration_no} />
                    <DetailRow label="Domain" value={result.domain} />
                    <DetailRow label="Mode" value={result.mode} />
                    <DetailRow label="Internship Start Date" value={result.start_date} />
                    <DetailRow label="Internship End Date" value={result.end_date} />
                    <DetailRow label="Marks" value={result.marks ? (result.marks.includes('/') ? result.marks : `${result.marks}/100`) : ''} />
                    <DetailRow label="Attendance" value={result.attendance} />
                  </dl>
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => void handleDownload()}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {downloading ? 'Downloading…' : 'Download Certificate'}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
                  <XCircle className="mx-auto h-10 w-10 text-red-500" />
                  <p className="mt-3 font-semibold text-red-900">Invalid Certificate Number</p>
                  <p className="mt-2 text-sm text-red-800">{result.message}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Employers and colleges can verify certificates anytime.{' '}
          <Link to="/contact" className="font-medium text-brand-accent hover:underline">
            Contact support
          </Link>{' '}
          if details look incorrect.
        </p>
      </div>
    </div>
  )
}
