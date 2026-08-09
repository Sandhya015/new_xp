import { Link } from 'react-router-dom'

type LegalPlaceholderProps = { title: string }

export function LegalPlaceholder({ title }: LegalPlaceholderProps) {
  const isSuccessStories = title.toLowerCase().includes('success')
  return (
    <div className="min-h-[50vh] px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold text-brand-navy sm:text-3xl">{title}</h1>
        <p className="mt-4 text-slate-gray">
          {isSuccessStories
            ? 'Student and partner success stories are coming soon. Meanwhile, join our affiliate program and grow with XpertIntern.'
            : 'This page is under preparation. Please check back later.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {isSuccessStories ? (
            <Link
              to="/apply-partner"
              className="inline-block rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition"
            >
              Become an Affiliate Partner
            </Link>
          ) : null}
          <Link
            to="/"
            className={`inline-block rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
              isSuccessStories
                ? 'border border-gray-300 text-brand-navy hover:bg-gray-50'
                : 'bg-brand-accent text-white hover:bg-primary-600'
            }`}
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
