/**
 * API base URL: uses env in build, or picks by host at runtime so the same
 * build works on live site (www.xpertintern.com) and local dev.
 */
const DEPLOYED_API_URL = 'https://kbp3dx8ic4.execute-api.ap-south-1.amazonaws.com/dev'

export function getApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && String(envUrl).trim()) return String(envUrl).trim()
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'www.xpertintern.com' || host === 'xpertintern.com') return DEPLOYED_API_URL
  }
  return 'http://localhost:5000'
}
