import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, Loader2 } from 'lucide-react'
import { BLOG_MAINTENANCE_DESCRIPTION, BLOG_MAINTENANCE_HEADING } from '@/constants/blogPublic'
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
  const [fetchFailed, setFetchFailed] = useState(false)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      setArticle(null)
      setFetchFailed(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setFetchFailed(false)
    void strapiService
      .getArticleBySlug(slug)
      .then((a) => {
        if (!cancelled) setArticle(a)
      })
      .catch(() => {
        if (!cancelled) {
          setFetchFailed(true)
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
        <div className="mt-10 rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <h1 className="text-xl font-bold text-brand-navy sm:text-2xl">{BLOG_MAINTENANCE_HEADING}</h1>
          <p className="mt-3 text-sm text-slate-gray leading-relaxed">{BLOG_MAINTENANCE_DESCRIPTION}</p>
        </div>
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

  if (fetchFailed || !article) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16 sm:px-6 lg:px-8">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Blog
        </Link>
        <div className="mt-10 rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <h1 className="text-xl font-bold text-brand-navy sm:text-2xl">{BLOG_MAINTENANCE_HEADING}</h1>
          <p className="mt-3 text-sm text-slate-gray leading-relaxed">{BLOG_MAINTENANCE_DESCRIPTION}</p>
        </div>
        <div className="mt-8 text-center">
          <Link
            to="/blog"
            className="inline-flex rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition"
          >
            Back to blog
          </Link>
        </div>
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
