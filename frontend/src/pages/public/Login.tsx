import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

type LoginForm = { email: string; password: string }
type Tab = 'student' | 'company'

export function Login() {
  const [tab, setTab] = useState<Tab>('student')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setUser, setToken } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    setSubmitting(true)
    try {
      const res = await authService.login(data.email, data.password)
      setToken(res.token)
      setUser(res.user)
      if (res.user?.role === 'company') navigate('/company', { replace: true })
      else navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Sign in failed'
      setError(msg || 'Invalid email or password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-50 flex justify-center px-4 py-8 sm:py-10 min-w-0">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xl overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setTab('student')}
              className={`flex-1 py-3.5 text-sm font-semibold transition rounded-tl-2xl ${tab === 'student' ? 'bg-brand-accent text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-b-2 border-transparent'}`}
            >
              Login as Student
            </button>
            <button
              type="button"
              onClick={() => setTab('company')}
              className={`flex-1 py-3.5 text-sm font-semibold transition rounded-tr-2xl ${tab === 'company' ? 'bg-brand-accent text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-b-2 border-transparent'}`}
            >
              Login as Company
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <h1 className="text-xl font-bold text-brand-navy sm:text-2xl">
              {tab === 'student' ? 'Student Login' : 'Company Login'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-gray">
              Sign in to your {tab === 'student' ? 'student' : 'company'} account.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">Email *</label>
                <input
                  id="login-email"
                  type="email"
                  {...register('email', { required: 'Email is required' })}
                  placeholder="your@email.com"
                  className="mt-1.5 block w-full min-w-0 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 focus:outline-none"
                />
                {errors.email && <p className="mt-1 text-sm text-error-red">{errors.email.message}</p>}
              </div>
              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">Password *</label>
                <div className="mt-1.5 relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    {...register('password', { required: 'Password is required' })}
                    placeholder="Your password"
                    className="block w-full min-w-0 rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 focus:outline-none"
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
                {errors.password && <p className="mt-1 text-sm text-error-red">{errors.password.message}</p>}
              </div>
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm font-medium text-brand-accent hover:underline transition">
                  Forgot Password?
                </Link>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-accent py-2.5 min-h-[44px] text-sm font-semibold text-white focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 transition shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-gray">
              Don&apos;t have an account? <Link to="/register" className="font-semibold text-brand-accent hover:underline">Register</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
