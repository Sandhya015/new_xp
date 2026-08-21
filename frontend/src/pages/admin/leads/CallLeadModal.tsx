import { useState } from 'react'
import { Loader2, Phone, X } from 'lucide-react'
import { crmService, type CrmLead } from '@/services/crmService'
import { leadInitials, maskMobileDisplay } from './shared'

type Props = {
  open: boolean
  lead: CrmLead | null
  onClose: () => void
  onCalled?: () => void
}

export function CallLeadModal({ open, lead, onClose, onCalled }: Props) {
  const [calling, setCalling] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const reset = () => {
    setCalling(false)
    setStatus('idle')
    setMessage('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const startCall = async () => {
    if (!lead || calling) return
    setCalling(true)
    setStatus('idle')
    setMessage('')
    try {
      const r = await crmService.initiateCall(lead.id)
      setStatus('success')
      setMessage(r.message || 'Call initiated — your extension will ring first.')
      onCalled?.()
    } catch {
      setStatus('error')
      setMessage('Call failed. Check TeleCMI credentials and try again.')
    } finally {
      setCalling(false)
    }
  }

  if (!open || !lead) return null

  return (
    <>
      <button type="button" className="lc-modal-backdrop" aria-label="Close" onClick={handleClose} />
      <div className="lc-call-modal" role="dialog" aria-labelledby="call-lead-title">
        <button type="button" onClick={handleClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>

        <span className="lc-avatar lc-call-modal-avatar">{leadInitials(lead.fullName)}</span>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          TeleCMI service on
        </p>

        <h2 id="call-lead-title" className="mt-2 text-center text-xl font-bold text-slate-900">
          {lead.fullName}
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500 tracking-wide">
          {maskMobileDisplay(lead.mobile)}
        </p>

        {status === 'idle' && !calling && (
          <>
            <p className="mt-8 text-center text-sm font-medium text-slate-600">Ready to call</p>
            <button
              type="button"
              onClick={startCall}
              className="lc-call-modal-btn mx-auto mt-4"
              aria-label="Start call"
            >
              <Phone className="h-7 w-7 text-white" strokeWidth={2} />
            </button>
          </>
        )}

        {(calling || status !== 'idle') && (
          <div className="mt-8 text-center">
            {calling ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-sm text-slate-600">Connecting call…</p>
              </div>
            ) : (
              <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{message}</p>
            )}
            {!calling && (
              <button type="button" onClick={handleClose} className="mt-4 text-sm font-semibold text-[#2563eb] hover:underline">
                Close
              </button>
            )}
          </div>
        )}

        {status === 'idle' && !calling && (
          <p className="mt-8 text-center text-xs text-slate-400">Your registered extension will ring first.</p>
        )}
      </div>
    </>
  )
}
