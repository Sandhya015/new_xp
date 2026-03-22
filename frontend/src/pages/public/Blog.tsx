import { Link } from 'react-router-dom'
import { Calendar, Clock, ArrowRight, BookOpen, Briefcase, GraduationCap, Sparkles, Mail } from 'lucide-react'

const categories = ['All', 'Internships', 'Career Tips', 'Training', 'Industry News', 'Student Success']

const featuredPost = {
  slug: 'how-to-land-your-first-internship',
  title: 'How to Land Your First Internship: A Student Playbook',
  excerpt:
    'From building a strong profile to acing interviews — practical steps that help B.Tech, Diploma, and non-technical students stand out to recruiters.',
  date: 'Mar 15, 2026',
  readMins: 6,
  tag: 'Career Tips',
  imageTone: 'from-brand-navy to-primary-800',
}

const posts = [
  {
    slug: 'aict-ugc-compliant-training',
    title: 'Why AICTE & UGC–Aligned Training Matters for Your Degree',
    excerpt: 'How structured, guideline-compliant programs help with credits, placements, and verified certificates.',
    date: 'Mar 10, 2026',
    readMins: 5,
    tag: 'Training',
  },
  {
    slug: 'resume-tips-internship',
    title: 'Resume Tips That Get Shortlisted for Internship Drives',
    excerpt: 'What hiring managers scan for first — and how to showcase projects without fluff.',
    date: 'Mar 5, 2026',
    readMins: 4,
    tag: 'Internships',
  },
  {
    slug: 'digital-skills-commerce-students',
    title: 'Digital Skills Every Commerce & Arts Student Should Explore',
    excerpt: 'Marketing, analytics, and CRM paths that open doors beyond traditional roles.',
    date: 'Feb 28, 2026',
    readMins: 7,
    tag: 'Student Success',
  },
  {
    slug: 'from-training-to-offer',
    title: 'From Training to Offer: Mapping Your 90-Day Plan',
    excerpt: 'A simple timeline to pair coursework with applications and follow-ups.',
    date: 'Feb 20, 2026',
    readMins: 5,
    tag: 'Career Tips',
  },
  {
    slug: 'partner-companies-look-for',
    title: 'What Our Partner Companies Look for in Interns',
    excerpt: 'Communication, ownership, and stack familiarity — distilled from real JDs.',
    date: 'Feb 12, 2026',
    readMins: 6,
    tag: 'Industry News',
  },
  {
    slug: 'hybrid-learning-tips',
    title: 'Making the Most of Hybrid & Online Training',
    excerpt: 'Routines, note-taking, and accountability that keep you on track.',
    date: 'Feb 1, 2026',
    readMins: 4,
    tag: 'Training',
  },
]

export function Blog() {
  return (
    <div className="min-w-0 bg-brand-light-bg">
      {/* Hero — internship / edtech style */}
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

      {/* Category chips */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2">
            {categories.map((c, i) => (
              <button
                key={c}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  i === 0 ? 'bg-brand-navy text-white' : 'bg-gray-100 text-brand-navy hover:bg-gray-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <h2 className="text-lg font-bold text-brand-navy sm:text-xl">Featured</h2>
        <Link
          to={`/blog/${featuredPost.slug}`}
          className="mt-4 block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg lg:grid lg:grid-cols-2 lg:gap-0"
        >
          <div className={`relative min-h-[200px] bg-gradient-to-br ${featuredPost.imageTone} lg:min-h-[280px]`}>
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <Briefcase className="h-24 w-24 text-white/25 sm:h-32 sm:w-32" strokeWidth={1} />
            </div>
            <span className="absolute left-4 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {featuredPost.tag}
            </span>
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-gray">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {featuredPost.date}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {featuredPost.readMins} min read
              </span>
            </div>
            <h3 className="mt-3 text-xl font-bold text-brand-navy sm:text-2xl">{featuredPost.title}</h3>
            <p className="mt-3 text-sm sm:text-base text-slate-gray leading-relaxed">{featuredPost.excerpt}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-accent">
              Read article <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        {/* Grid */}
        <h2 className="mt-14 text-lg font-bold text-brand-navy sm:text-xl">Latest articles</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <Link to={`/blog/${post.slug}`} className="block aspect-[16/10] bg-gradient-to-br from-primary-100 to-brand-light-bg relative">
                <Sparkles className="absolute right-4 top-4 h-8 w-8 text-brand-accent/40" />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-brand-navy shadow-sm">
                  {post.tag}
                </span>
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap gap-2 text-xs text-slate-gray">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {post.date}
                  </span>
                  <span>·</span>
                  <span>{post.readMins} min</span>
                </div>
                <h3 className="mt-2 text-base font-bold text-brand-navy group-hover:text-brand-accent transition line-clamp-2">
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <p className="mt-2 flex-1 text-sm text-slate-gray leading-relaxed line-clamp-3">{post.excerpt}</p>
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
      </section>

      {/* CTA strip */}
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
