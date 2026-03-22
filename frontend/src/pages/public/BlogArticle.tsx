import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/** Placeholder until CMS or static MDX articles are wired */
export function BlogArticle() {
  const { slug } = useParams()
  const title = slug
    ? slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Article'

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16 sm:px-6 lg:px-8">
      <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Blog
      </Link>
      <h1 className="mt-6 text-2xl font-bold text-brand-navy sm:text-3xl">{title}</h1>
      <p className="mt-4 text-slate-gray leading-relaxed">
        This article is being prepared. Check back soon for the full story — or explore training and internships on the home page.
      </p>
      <Link
        to="/training"
        className="mt-8 inline-flex rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition"
      >
        Explore training
      </Link>
    </div>
  )
}
