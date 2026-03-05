import { Link } from 'react-router-dom'

export function Internship() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 sm:py-20 min-w-0">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-brand-light-bg/80 p-6 sm:p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary-100 text-3xl sm:text-4xl" aria-hidden>🚀</div>
        <h1 className="mt-4 sm:mt-6 text-xl font-bold text-brand-navy sm:text-2xl md:text-3xl">Internship Program</h1>
        <p className="mt-2 sm:mt-3 text-base sm:text-lg font-medium text-brand-accent">Coming Soon</p>
        <p className="mt-2 text-sm sm:text-base text-gray-600">
          We&apos;re preparing something amazing. Our internship module will connect you with partner companies and verified certificates.
        </p>
        <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link to="/training" className="inline-flex items-center justify-center rounded-lg bg-brand-accent px-4 py-2.5 sm:px-5 min-h-[44px] text-sm font-semibold text-white hover:bg-primary-600 transition">Explore Trainings</Link>
          <Link to="/" className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 sm:px-5 min-h-[44px] text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
