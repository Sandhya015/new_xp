/** Load Razorpay Checkout script once (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/) */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: (err: unknown) => void) => void }
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(!!window.Razorpay))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => resolve(!!window.Razorpay)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}
