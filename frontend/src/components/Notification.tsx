import { X } from 'lucide-react'

interface NotificationProps {
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  onDismiss?: () => void
}

export function Notification({ title, message, type = 'info', onDismiss }: NotificationProps) {
  const styles = {
    info: 'bg-primary-50 border-primary-200 text-brand-navy',
    success: 'bg-emerald-50 border-emerald-500 text-emerald-800',
    warning: 'bg-amber-50 border-amber-500 text-amber-800',
    error: 'bg-red-50 border-red-500 text-red-800',
  }
  return (
    <div className={`rounded-lg border p-4 ${styles[type]}`} role="alert">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm opacity-90">{message}</p>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="p-1 rounded hover:bg-black/5" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
