import { Link } from 'react-router-dom'

export function InternshipPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20">
      <div className="max-w-lg rounded-2xl border border-gray-200 bg-gray-50/80 p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-4xl" aria-hidden>
          🚀
        </div>
        <h1 className="mt-6 text-2xl font-bold text-brand-navy sm:text-3xl">Internship Program</h1>
        <p className="mt-3 text-lg font-medium text-primary-600">Coming Soon</p>
        <p className="mt-2 text-gray-600">
          We&apos;re preparing something amazing. Our internship module will connect you with partner companies and verified certificates.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            to="/programs"
            className="inline-flex rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition"
          >
            Explore Trainings
          </Link>
          <Link
            to="/"
            className="inline-flex rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
