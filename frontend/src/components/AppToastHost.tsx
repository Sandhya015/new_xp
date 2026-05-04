import { useEffect, useState } from 'react'

type ToastDetail = { message: string; variant?: 'success' | 'error' }

export function AppToastHost() {
  const [toast, setToast] = useState<ToastDetail | null>(null)

  useEffect(() => {
    const onToast = (ev: Event) => {
      const e = ev as CustomEvent<ToastDetail>
      const d = e.detail
      if (!d?.message) return
      setToast({ message: d.message, variant: d.variant || 'success' })
      window.setTimeout(() => setToast(null), 4500)
    }
    window.addEventListener('xpi-app-toast', onToast as EventListener)
    return () => window.removeEventListener('xpi-app-toast', onToast as EventListener)
  }, [])

  if (!toast) return null

  const isErr = toast.variant === 'error'
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 px-4 w-full max-w-md pointer-events-none"
      role="status"
    >
      <div
        className={`rounded-lg border px-4 py-3 text-sm font-medium shadow-lg text-center pointer-events-auto ${
          isErr ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
        }`}
      >
        {toast.message}
      </div>
    </div>
  )
}

export function showAppToast(message: string, variant: 'success' | 'error' = 'success') {
  window.dispatchEvent(new CustomEvent('xpi-app-toast', { detail: { message, variant } }))
}
