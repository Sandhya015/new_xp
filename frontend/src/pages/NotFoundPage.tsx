import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <p className="text-6xl font-bold text-primary-200">404</p>
      <h1 className="mt-4 text-2xl font-bold text-brand-navy">Page not found</h1>
      <p className="mt-2 text-gray-600">The page you’re looking for doesn’t exist or has been moved.</p>
      <Link to="/" className="mt-8 rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition">
        Go to Home
      </Link>
    </div>
  )
}
