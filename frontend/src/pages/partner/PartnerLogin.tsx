import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

export function PartnerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await authService.login(email, password)
      if (res.user?.role !== 'partner') {
        setError('This login is for affiliate partners only. Use the main site login for student/company accounts.')
        return
      }
      setSession(res.user, res.token, typeof res.expiresIn === 'number' ? res.expiresIn : undefined)
      if (res.user?.forcePasswordChange || res.forcePasswordChange) {
        navigate('/change-password?forced=1', { replace: true })
        return
      }
      navigate('/partner', { replace: true })
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Sign in failed')
          : 'Email or password is incorrect. Please try again.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-brand-navy">Partner login</h1>
        <p className="mt-1 text-sm text-slate-gray">XpertIntern Affiliate Dashboard</p>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
          <input className="w-full rounded-lg border px-3 py-2 text-sm" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="w-full rounded-lg border px-3 py-2 text-sm" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-white">
            {busy ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs">
          <Link to="/forgot-password" className="text-brand-accent">
            Forgot password?
          </Link>
        </p>
        <p className="mt-6 text-center text-sm text-slate-gray">
          New partner?{' '}
          <Link to="/apply-partner" className="font-medium text-brand-accent">
            Apply here
          </Link>
        </p>
      </div>
    </div>
  )
}
