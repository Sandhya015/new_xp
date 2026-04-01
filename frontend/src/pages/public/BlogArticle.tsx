import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, Loader2 } from 'lucide-react'
import { strapiService, type StrapiArticle } from '@/services/strapiService'

function formatBlogDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function BlogArticle() {
  const { slug } = useParams()
  const [article, setArticle] = useState<StrapiArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      setArticle(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void strapiService
      .getArticleBySlug(slug)
      .then((a) => {
        if (!cancelled) setArticle(a)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load article.')
          setArticle(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (!slug) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16 sm:px-6 lg:px-8">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Blog
        </Link>
        <p className="mt-6 text-slate-gray">Invalid article link.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8 flex flex-col items-center gap-3 text-slate-gray">
        <Loader2 className="h-10 w-10 animate-spin text-brand-accent" aria-hidden />
        <p className="text-sm font-medium">Loading article…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16 sm:px-6 lg:px-8">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Blog
        </Link>
        <p className="mt-6 text-brand-navy font-semibold">Could not load this article.</p>
        <p className="mt-2 text-sm text-slate-gray">{error}</p>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16 sm:px-6 lg:px-8">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Blog
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-brand-navy sm:text-3xl">Article not found</h1>
        <p className="mt-4 text-slate-gray leading-relaxed">
          This post may have been removed or the link is incorrect. If you use Strapi, ensure the entry is{' '}
          <strong>published</strong> and the slug matches.
        </p>
        <Link
          to="/blog"
          className="mt-8 inline-flex rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition"
        >
          View all posts
        </Link>
      </div>
    )
  }

  return (
    <div className="min-w-0 bg-brand-light-bg pb-16">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14 sm:px-6 lg:px-8">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Blog
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-gray">
          <span className="rounded-full bg-primary-100 px-2.5 py-0.5 font-semibold text-brand-navy">{article.category}</span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> {formatBlogDate(article.publishedDate) || '—'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {article.readTime} min read
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-bold text-brand-navy sm:text-4xl tracking-tight">{article.title}</h1>

        {article.coverImageUrl && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <img src={article.coverImageUrl} alt="" className="w-full object-cover max-h-[420px]" />
          </div>
        )}

        <div
          className="strapi-rich-text mt-8 text-slate-gray"
          dangerouslySetInnerHTML={{
            __html: article.descriptionHtml || '<p>No content yet.</p>',
          }}
        />
      </div>
    </div>
  )
}
