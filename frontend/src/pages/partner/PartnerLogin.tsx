import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'
import { AuthLoadingOverlay } from '@/components/ui/AuthLoadingOverlay'

export function PartnerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authService.login(email, password)
      if (res.user?.role !== 'partner') {
        setError('This login is for affiliate partners only. Use the main site login for student or company accounts.')
        return
      }
      setSession(res.user, res.token, typeof res.expiresIn === 'number' ? res.expiresIn : undefined)
      if (res.user?.forcePasswordChange || res.forcePasswordChange) {
        navigate('/change-password?forced=1&next=/partner&from=partner', { replace: true })
        return
      }
      navigate('/partner', { replace: true })
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : ''
      setError(msg || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row min-w-0 relative">
      <AuthLoadingOverlay
        show={loading}
        ariaLabel="Signing you in as partner"
        message="Loading"
      />
      <div className="bg-brand-navy text-white p-6 sm:p-8 md:p-12 md:w-2/5 flex flex-col justify-center min-w-0">
        <div className="mb-6 sm:mb-8 inline-flex w-fit bg-white px-4 py-3">
          <img src="/logo.png" alt="XpertIntern" className="h-12 sm:h-14 md:h-16 w-auto object-contain" />
        </div>
        <p className="text-xs sm:text-sm font-medium text-primary-200 uppercase tracking-wider">Partner Portal</p>
        <h1 className="mt-2 text-xl sm:text-2xl font-bold">Partner Login</h1>
        <p className="mt-2 text-gray-300 text-xs sm:text-sm">
          Sign in to your XpertIntern affiliate dashboard — links, coupons, referrals, and payouts.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-gray-50 min-w-0">
        <div className="w-full max-w-md min-w-0">
          <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 md:p-8 shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold text-brand-navy">Partner sign in</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-gray">Enter your partner account credentials</p>
            <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 sm:mt-8 space-y-4 sm:space-y-5">
              <div>
                <label htmlFor="partner-email" className="block text-sm font-medium text-gray-700">Email</label>
                <div className="mt-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="partner-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full min-w-0 rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-base sm:text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    placeholder="partner@example.com"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="partner-password" className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="partner-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full min-w-0 rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-base sm:text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand-accent py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-primary-600 transition disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in to Partner Portal'}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-gray-500 space-x-2">
              <Link to="/forgot-password" className="text-brand-accent hover:underline">Forgot password?</Link>
              <span aria-hidden>·</span>
              <Link to="/" className="text-brand-accent hover:underline">Back to home</Link>
            </p>
            <p className="mt-4 text-center text-sm text-slate-gray">
              New partner?{' '}
              <Link to="/apply-partner" className="font-medium text-brand-accent hover:underline">
                Apply here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
