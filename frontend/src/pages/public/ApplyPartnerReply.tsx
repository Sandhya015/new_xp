import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { partnerService } from '@/services/partnerService'
import { AffiliatePageWrap } from '@/components/partner/AffiliateLandingShell'

export function ApplyPartnerReply() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await partnerService.reply(token, message)
      setDone(true)
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed')
          : 'Failed'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <AffiliatePageWrap>
        <p className="text-center text-sm text-red-600">Invalid reply link.</p>
      </AffiliatePageWrap>
    )
  }
  if (done) {
    return (
      <AffiliatePageWrap>
        <p className="text-center text-sm text-emerald-700">Reply submitted. Thank you — our team will continue the review.</p>
      </AffiliatePageWrap>
    )
  }

  return (
    <AffiliatePageWrap>
      <h1 className="text-xl font-bold text-[#0f172a]">Reply to application review</h1>
      <textarea className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your reply…" />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button type="button" disabled={busy || !message.trim()} onClick={() => void submit()} className="mt-4 rounded-xl bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
        {busy ? 'Sending…' : 'Submit reply'}
      </button>
    </AffiliatePageWrap>
  )
}
