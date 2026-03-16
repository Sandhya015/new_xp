import { Link } from 'react-router-dom'

type LegalPlaceholderProps = { title: string }

export function LegalPlaceholder({ title }: LegalPlaceholderProps) {
  return (
    <div className="min-h-[50vh] px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold text-brand-navy sm:text-3xl">{title}</h1>
        <p className="mt-4 text-slate-gray">This page is under preparation. Please check back later.</p>
        <Link to="/" className="mt-6 inline-block rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition">
          Back to Home
        </Link>
      </div>
    </div>
  )
}
