import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, KeyRound, Link2Off, Lock, ShieldCheck } from 'lucide-react'
import { authService } from '@/services/authService'

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 flex justify-center px-4 py-10 sm:py-14 min-w-0">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-brand-navy via-brand-accent to-primary-500" aria-hidden />
          {children}
        </div>
      </div>
    </div>
  )
}

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams])

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [doneMessage, setDoneMessage] = useState('')

  const pwdLenOk = password.length >= 8
  const pwdMatch = confirm.length > 0 && password === confirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('This reset link is missing a token. Open the link from your email, or request a new reset.')
      return
    }
    setLoading(true)
    try {
      const res = await authService.resetPassword({
        token,
        newPassword: password,
        confirmPassword: confirm,
      })
      setDoneMessage(res.message || 'Your password has been updated.')
      setDone(true)
      window.setTimeout(() => navigate('/login', { replace: true }), 2200)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Could not reset password'
      setError(msg || 'Could not reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!token && !done) {
    return (
      <CardShell>
        <div className="p-6 sm:p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-light-bg border border-primary-200">
            <Link2Off className="h-7 w-7 text-brand-accent" aria-hidden />
          </div>
          <h1 className="mt-5 text-xl font-bold text-brand-navy sm:text-2xl">Link not valid</h1>
          <p className="mt-2 text-sm text-slate-gray leading-relaxed max-w-sm mx-auto">
            This page needs a secure token from your password reset email. If the link expired, request a new one.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 transition"
            >
              Request new link
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg border-2 border-brand-accent bg-white px-5 py-2.5 text-sm font-semibold text-brand-accent hover:bg-brand-light-bg transition"
            >
              Back to login
            </Link>
          </div>
        </div>
      </CardShell>
    )
  }

  if (done) {
    return (
      <CardShell>
        <div className="p-6 sm:p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
            <ShieldCheck className="h-7 w-7 text-emerald-600" aria-hidden />
          </div>
          <h1 className="mt-5 text-xl font-bold text-brand-navy sm:text-2xl">Password updated</h1>
          <p className="mt-2 text-sm text-slate-gray leading-relaxed max-w-sm mx-auto">{doneMessage}</p>
          <p className="mt-3 text-xs font-medium text-emerald-700">Redirecting you to sign in…</p>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 transition"
          >
            Go to login
          </Link>
        </div>
      </CardShell>
    )
  }

  return (
    <CardShell>
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-light-bg border border-primary-200">
            <KeyRound className="h-6 w-6 text-brand-accent" aria-hidden />
          </div>
          <div className="min-w-0 pt-0.5">
            <h1 className="text-xl font-bold text-brand-navy sm:text-2xl leading-tight">Reset your password</h1>
            <p className="mt-1.5 text-sm text-slate-gray leading-relaxed">
              Enter a new password for your XpertIntern account. Use at least 8 characters.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700">New password *</label>
            <div className="mt-1.5 relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="block w-full min-w-0 rounded-lg border border-gray-300 py-2.5 pl-10 pr-11 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-gray-500">
              <li className={`flex items-center gap-1.5 ${pwdLenOk ? 'text-emerald-700 font-medium' : ''}`}>
                <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${pwdLenOk ? 'text-emerald-600' : 'text-gray-300'}`} aria-hidden />
                At least 8 characters
              </li>
            </ul>
          </div>

          <div>
            <label htmlFor="reset-confirm" className="block text-sm font-medium text-gray-700">Confirm new password *</label>
            <div className="mt-1.5 relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="reset-confirm"
                type={showConfirm ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                className="block w-full min-w-0 rounded-lg border border-gray-300 py-2.5 pl-10 pr-11 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {confirm.length > 0 ? (
              <p className={`mt-1.5 text-xs font-medium ${pwdMatch ? 'text-emerald-700' : 'text-amber-700'}`}>
                {pwdMatch ? 'Passwords match' : 'Passwords must match'}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading || !pwdLenOk || !pwdMatch}
            className="w-full rounded-lg bg-brand-accent py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating password…' : 'Update password'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-gray border-t border-gray-100 pt-6">
          Remember your password?{' '}
          <Link to="/login" className="font-semibold text-brand-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </CardShell>
  )
}
