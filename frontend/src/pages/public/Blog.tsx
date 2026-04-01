import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, ArrowRight, BookOpen, Briefcase, GraduationCap, Sparkles, Mail, Loader2 } from 'lucide-react'
import {
  BLOG_EMPTY_DESCRIPTION,
  BLOG_EMPTY_HEADING,
  BLOG_MAINTENANCE_DESCRIPTION,
  BLOG_MAINTENANCE_HEADING,
} from '@/constants/blogPublic'
import { strapiService, type StrapiArticle } from '@/services/strapiService'

function formatBlogDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

const featuredGradients = [
  'from-brand-navy to-primary-800',
  'from-primary-900 to-brand-navy',
  'from-primary-800 to-primary-950',
] as const

export function Blog() {
  const [articles, setArticles] = useState<StrapiArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('All')

  const load = useCallback(async () => {
    setLoading(true)
    setFetchFailed(false)
    try {
      const data = await strapiService.getArticles()
      setArticles(data)
    } catch {
      setArticles([])
      setFetchFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const categories = useMemo(() => {
    const unique = new Set<string>()
    for (const a of articles) unique.add(a.category)
    const sorted = [...unique].sort((a, b) => a.localeCompare(b))
    return ['All', ...sorted]
  }, [articles])

  const filtered = useMemo(() => {
    if (selectedCategory === 'All') return articles
    return articles.filter((a) => a.category === selectedCategory)
  }, [articles, selectedCategory])

  const featured = filtered[0]
  const gridPosts = filtered.slice(1)

  return (
    <div className="min-w-0 bg-brand-light-bg">
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy via-primary-900 to-primary-950 text-white">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-accent/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-200">
              <BookOpen className="h-3.5 w-3.5" /> XpertIntern Blog
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Insights for your next internship &amp; training move
            </h1>
            <p className="mt-4 text-base sm:text-lg text-gray-300 leading-relaxed">
              Guides, career tips, and updates — built for students, educators, and placement teams across India.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
                <GraduationCap className="h-4 w-4 text-primary-300" /> AICTE | UGC | NEP 2020
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
                <Briefcase className="h-4 w-4 text-primary-300" /> Internships &amp; training
              </span>
            </div>
          </div>
        </div>
      </section>

      {!fetchFailed && articles.length > 0 && (
        <section className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCategory(c)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    selectedCategory === c ? 'bg-brand-navy text-white' : 'bg-gray-100 text-brand-navy hover:bg-gray-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {fetchFailed ? (
          <div
            className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm"
            role="status"
          >
            <BookOpen className="mx-auto h-12 w-12 text-brand-accent/80" aria-hidden />
            <h2 className="mt-6 text-xl font-bold text-brand-navy sm:text-2xl">{BLOG_MAINTENANCE_HEADING}</h2>
            <p className="mt-3 text-sm text-slate-gray leading-relaxed">{BLOG_MAINTENANCE_DESCRIPTION}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-gray">
            <Loader2 className="h-10 w-10 animate-spin text-brand-accent" aria-hidden />
            <p className="text-sm font-medium">Loading articles…</p>
          </div>
        ) : !featured ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
            <BookOpen className="mx-auto h-12 w-12 text-brand-accent/80" aria-hidden />
            <h2 className="text-xl font-bold text-brand-navy sm:text-2xl">{BLOG_EMPTY_HEADING}</h2>
            <p className="mt-3 text-sm text-slate-gray leading-relaxed">{BLOG_EMPTY_DESCRIPTION}</p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-brand-navy sm:text-xl">Featured</h2>
            <Link
              to={`/blog/${featured.slug}`}
              className="mt-4 block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg lg:grid lg:grid-cols-2 lg:gap-0"
            >
              <div className="relative min-h-[200px] overflow-hidden lg:min-h-[280px]">
                {featured.coverImageUrl ? (
                  <img
                    src={featured.coverImageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${featuredGradients[featured.id % featuredGradients.length]}`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center p-8">
                      <Briefcase className="h-24 w-24 text-white/25 sm:h-32 sm:w-32" strokeWidth={1} />
                    </div>
                  </div>
                )}
                <span className="absolute left-4 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  {featured.category}
                </span>
              </div>
              <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8 lg:p-10 lg:pr-12">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-gray">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> {formatBlogDate(featured.publishedDate) || '—'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {featured.readTime} min read
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-bold text-brand-navy sm:text-2xl text-balance">{featured.title}</h3>
                <p className="mt-3 max-w-xl text-sm sm:text-base text-slate-gray leading-relaxed text-pretty line-clamp-4">
                  {featured.excerptPlain || 'Read the full article.'}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-accent">
                  Read article <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {gridPosts.length > 0 && (
              <>
                <h2 className="mt-14 text-lg font-bold text-brand-navy sm:text-xl">Latest articles</h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {gridPosts.map((post) => (
                    <article
                      key={post.slug}
                      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                    >
                      <Link
                        to={`/blog/${post.slug}`}
                        className="relative block aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary-100 to-brand-light-bg"
                      >
                        {post.coverImageUrl ? (
                          <img
                            src={post.coverImageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
                          />
                        ) : (
                          <Sparkles className="absolute right-4 top-4 h-8 w-8 text-brand-accent/40" />
                        )}
                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-brand-navy shadow-sm">
                          {post.category}
                        </span>
                      </Link>
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex flex-wrap gap-2 text-xs text-slate-gray">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatBlogDate(post.publishedDate) || '—'}
                          </span>
                          <span>·</span>
                          <span>{post.readTime} min</span>
                        </div>
                        <h3 className="mt-2 text-base font-bold text-brand-navy group-hover:text-brand-accent transition line-clamp-2">
                          <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                        </h3>
                        <p className="mt-2 flex-1 text-sm text-slate-gray leading-relaxed text-pretty line-clamp-3">
                          {post.excerptPlain || 'Read the full article.'}
                        </p>
                        <Link
                          to={`/blog/${post.slug}`}
                          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-accent"
                        >
                          Read more <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      <section className="border-t border-gray-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-r from-brand-navy to-primary-900 px-6 py-10 text-center text-white sm:px-10">
            <Mail className="mx-auto h-10 w-10 text-primary-300" />
            <h2 className="mt-4 text-xl font-bold sm:text-2xl">Get new posts in your inbox</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-300">
              Internship alerts, training launches, and career tips — no spam.
            </p>
            <form className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="you@example.com"
                className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-400 focus:border-brand-accent focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-brand-accent px-6 py-3 text-sm font-semibold text-white hover:bg-primary-600 transition"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
