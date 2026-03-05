import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: POST /api/auth/forgot-password
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-gray-100/80 flex items-center justify-center px-4 py-10 sm:py-16 min-w-0">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-lg">
          <h1 className="text-xl font-bold text-brand-navy sm:text-2xl">Forgot Password</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          {sent ? (
            <div className="mt-6 rounded-lg bg-green-50 border border-green-200 p-4">
              <p className="text-sm font-medium text-green-800">Check your email</p>
              <p className="mt-1 text-sm text-green-700">If an account exists for {email}, you will receive a password reset link.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700">Email *</label>
                <div className="mt-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition"
              >
                Send reset link
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-600">
            <Link to="/login" className="font-semibold text-brand-accent hover:underline">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
