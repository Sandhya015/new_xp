/**
 * API base URL. When running on localhost we always use the local backend to avoid CORS.
 * On production host we use VITE_API_URL from build or the deployed API.
 */
const DEPLOYED_API_URL = 'https://kbp3dx8ic4.execute-api.ap-south-1.amazonaws.com/dev'
const LOCAL_API_URL = 'http://localhost:5000'

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    // Local dev: always hit local backend so we don't get CORS from deployed API
    if (host === 'localhost' || host === '127.0.0.1') return LOCAL_API_URL
    if (host === 'www.xpertintern.com' || host === 'xpertintern.com') return DEPLOYED_API_URL
  }
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && String(envUrl).trim()) return String(envUrl).trim()
  return LOCAL_API_URL
}
