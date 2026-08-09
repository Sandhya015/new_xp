/** Capture ?ref= referral slug: cookie xpi_ref (30d) + backend click track. */
const COOKIE = 'xpi_ref'
const DAYS = 30

export function getPartnerRef(): string {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))
    return m ? decodeURIComponent(m[1]) : ''
  } catch {
    return ''
  }
}

export function setPartnerRef(slug: string) {
  const s = (slug || '').trim()
  if (!s) return
  const maxAge = DAYS * 86400
  document.cookie = `${COOKIE}=${encodeURIComponent(s)}; path=/; max-age=${maxAge}; SameSite=Lax`
  try {
    localStorage.setItem(COOKIE, s)
  } catch {
    /* ignore */
  }
}

export function capturePartnerRefFromUrl(apiBase?: string) {
  try {
    const params = new URLSearchParams(window.location.search)
    const ref = (params.get('ref') || '').trim()
    if (!ref) return
    setPartnerRef(ref)
    const base = apiBase || import.meta.env.VITE_API_URL || ''
    const url = `${String(base).replace(/\/$/, '')}/api/partners/track-click`
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref, source: document.referrer || 'direct' }),
    }).catch(() => undefined)
  } catch {
    /* ignore */
  }
}
