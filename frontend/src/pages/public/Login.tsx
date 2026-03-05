import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '@/store/authStore'

type LoginForm = { email: string; password: string }
type Tab = 'student' | 'company'

/** Derive a display name from email (e.g. "john.doe@example.com" -> "John Doe") for mock auth */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Student'
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length === 0) return 'Student'
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
}

export function Login() {
  const [tab, setTab] = useState<Tab>('student')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setUser, setToken } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    setSubmitting(true)
    try {
      // Mock auth until backend is wired: accept any email + password and sign in
      const name = nameFromEmail(data.email)
      setUser({
        id: 'mock-user-id',
        name,
        email: data.email,
        role: tab === 'student' ? 'student' : 'company',
      })
      setToken('mock-token')
      navigate(tab === 'student' ? '/dashboard' : '/company', { replace: true })
    } catch {
      setError('Sign in failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-50 flex justify-center px-4 py-8 sm:py-10 min-w-0">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xl overflow-hidden">
          {/* Tabs */}
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
                <input
                  id="login-password"
                  type="password"
                  {...register('password', { required: 'Password is required' })}
                  placeholder="Your password"
                  className="mt-1.5 block w-full min-w-0 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 focus:outline-none"
                />
                {errors.password && <p className="mt-1 text-sm text-error-red">{errors.password.message}</p>}
              </div>
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm font-medium text-brand-accent hover:text-primary-700 hover:underline transition">
                  Forgot Password?
                </Link>
              </div>
              {error && (
                <p className="text-sm text-error-red">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-accent py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-primary-600 focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 transition shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
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
