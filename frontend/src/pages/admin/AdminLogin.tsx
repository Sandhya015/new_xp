import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

export function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setToken, setUser } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authService.login(email, password)
      if (data.user?.role !== 'admin') {
        setError('Admin access only. Use the main site to sign in as student or company.')
        return
      }
      setToken(data.token)
      setUser(data.user)
      navigate('/admin')
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Login failed'
      setError(msg || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row min-w-0">
      <div className="bg-brand-navy text-white p-6 sm:p-8 md:p-12 md:w-2/5 flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <img src="/logo.png" alt="XpertIntern" className="h-14 sm:h-16 md:h-20 w-auto object-contain" />
        </div>
        <p className="text-xs sm:text-sm font-medium text-primary-200 uppercase tracking-wider">Admin Panel</p>
        <h1 className="mt-2 text-xl sm:text-2xl font-bold">Admin Login</h1>
        <p className="mt-2 text-gray-300 text-xs sm:text-sm">Sign in to manage trainings, certificates, and students.</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-gray-50 min-w-0">
        <div className="w-full max-w-md min-w-0">
          <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 md:p-8 shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold text-brand-navy">Sign in</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-gray">Enter your admin credentials</p>
            <form onSubmit={handleSubmit} className="mt-6 sm:mt-8 space-y-4 sm:space-y-5">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700">Email</label>
                <div className="mt-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="admin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full min-w-0 rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-base sm:text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    placeholder="admin@xpertintern.com"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
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
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand-accent py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-primary-600 transition disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-gray-500">
              <Link to="/" className="text-brand-accent hover:underline">Back to home</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
