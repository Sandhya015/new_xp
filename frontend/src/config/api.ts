/**
 * API base URL.
 * - localhost → local Flask
 * - Any other host (xpertintern.com, *.vercel.app, Amplify, etc.) → production API unless VITE_API_URL overrides
 */
const DEPLOYED_API_URL = 'https://kbp3dx8ic4.execute-api.ap-south-1.amazonaws.com/dev'
const LOCAL_API_URL = 'http://localhost:5000'

/** Resolve a path like `/api/courses/media/...` or a same-origin API URL for use in `<img src>` / `<video src>`. */
export function absoluteApiUrl(pathOrUrl: string): string {
  const raw = (pathOrUrl || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  const base = getApiBase().replace(/\/$/, '')
  if (raw.startsWith('/')) return `${base}${raw}`
  return `${base}/${raw}`
}

export function getApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && String(envUrl).trim()) {
    return String(envUrl).trim()
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return LOCAL_API_URL
    }
    // Do not use localhost for real deploys (Vercel, custom domain, preview URLs, etc.)
    return DEPLOYED_API_URL
  }

  return LOCAL_API_URL
}
