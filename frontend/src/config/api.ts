/**
 * API base URL.
 * - localhost → local Flask
 * - Any other host (xpertintern.com, *.vercel.app, Amplify, etc.) → production API unless VITE_API_URL overrides
 */
const DEPLOYED_API_URL = 'https://kbp3dx8ic4.execute-api.ap-south-1.amazonaws.com/dev'
const LOCAL_API_URL = 'http://localhost:5000'

function isLoopbackHost(hostname: string): boolean {
  const h = (hostname || '').toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

function isAwsExecuteApiHost(hostname: string): boolean {
  const h = (hostname || '').toLowerCase()
  return h.endsWith('.amazonaws.com') && h.includes('execute-api')
}

/**
 * Resolve `/api/...` or full URLs for `<img src>` / `<video src>`.
 * Full URLs pointing at a dev API (localhost) are re-mapped to the current `getApiBase()` so
 * production pages never embed mixed-content localhost links from older saves.
 */
export function absoluteApiUrl(pathOrUrl: string): string {
  const raw = (pathOrUrl || '').trim()
  if (!raw) return ''
  const base = getApiBase().replace(/\/$/, '')

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw)
      if (isLoopbackHost(u.hostname)) {
        const path = `${u.pathname || ''}${u.search || ''}${u.hash || ''}`
        if (path.startsWith('/api/')) {
          return `${base}${path}`
        }
      }
      // Old saves may embed a full API Gateway URL for course media; always use the
      // currently configured API base so dev/stage/prod renames do not break <img src>.
      if (isAwsExecuteApiHost(u.hostname)) {
        const idx = u.pathname.indexOf('/api/courses/media/')
        if (idx >= 0) {
          const path = `${u.pathname.slice(idx)}${u.search || ''}${u.hash || ''}`
          return `${base}${path}`
        }
      }
    } catch {
      /* ignore parse errors */
    }
    return raw
  }

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
