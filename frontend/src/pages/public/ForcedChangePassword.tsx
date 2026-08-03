/**
 * Forced password change after SA direct password set (Rev 2 §5).
 * User is signed in but cannot use the app until they pick a new password.
 */
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

export function ForcedChangePassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const setSession = useAuthStore((s) => s.setSession)
  const logout = useAuthStore((s) => s.logout)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!token) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <p className="text-sm text-slate-gray">
          Please <Link to="/login" className="text-brand-accent font-semibold">sign in</Link> first.
        </p>
      </div>
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      setError('Password must include at least one letter and one number.')
      return
    }
    if (next !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (next === current) {
      setError('New password must be different from the current password.')
      return
    }
    setBusy(true)
    try {
      const res = await authService.changePassword(current, next, confirm)
      if (res.token && res.user) {
        setSession(res.user as typeof user, res.token, res.expiresIn)
      } else if (user) {
        setSession({ ...user, forcePasswordChange: false }, token, undefined)
      }
      const nextPath = searchParams.get('next')
      if (nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')) {
        navigate(nextPath, { replace: true })
      } else if (user?.role === 'company') {
        navigate('/company', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null
      setError(msg || 'Could not update password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gray-50 flex justify-center px-4 py-10 min-w-0">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h1 className="text-xl font-bold text-brand-navy">Change your password</h1>
        <p className="mt-2 text-sm text-slate-gray">
          Your password was reset by support. For security you must choose a new password before continuing
          {user?.email ? ` as ${user.email}` : ''}.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Current password</span>
            <div className="mt-1 relative">
              <input
                type={show ? 'text' : 'password'}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                onClick={() => setShow((s) => !s)}
                aria-label="Toggle visibility"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">New password</span>
            <input
              type={show ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Confirm new password</span>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-slate-gray hover:underline"
          onClick={() => {
            logout()
            navigate('/login', { replace: true })
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
