import { Link } from 'react-router-dom'
import { useState } from 'react'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: call auth API when backend is wired
    console.log({ email, password })
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-navy">Login</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in to your account</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-accent py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition"
          >
            Sign in
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-brand-accent hover:underline">Register</Link>
        </p>
      </div>
      <p className="mt-4 text-center text-xs text-gray-500">Auth will connect to backend when API is ready.</p>
    </div>
  )
}
