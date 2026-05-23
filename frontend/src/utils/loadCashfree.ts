/** Cashfree hosted checkout script (Payments JS SDK v3) */
export type CashfreeMode = 'sandbox' | 'production'

export type CashfreeCheckoutResult = {
  error?: { message?: string }
  redirect?: boolean
  paymentDetails?: unknown
}

export type CashfreeInstance = {
  checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => Promise<CashfreeCheckoutResult>
}

declare global {
  interface Window {
    Cashfree?: (opts: { mode: CashfreeMode }) => CashfreeInstance
  }
}

const CF_SCRIPT = 'https://sdk.cashfree.com/js/v3/cashfree.js'

export function loadCashfreeScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }
    if (typeof window.Cashfree === 'function') {
      resolve(true)
      return
    }
    const existing = document.querySelector(`script[src="${CF_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(typeof window.Cashfree === 'function'))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const s = document.createElement('script')
    s.src = CF_SCRIPT
    s.async = true
    s.onload = () => resolve(typeof window.Cashfree === 'function')
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}
