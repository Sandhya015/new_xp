import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { fetchSupportContent, type SupportFaqItem } from '@/services/supportContentService'

export function PublicFaq() {
  const [faqs, setFaqs] = useState<SupportFaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [category, setCategory] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchSupportContent('public')
      .then((r) => {
        if (!cancelled) setFaqs(r.faqs || [])
      })
      .catch(() => {
        if (!cancelled) setFaqs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(() => {
    const s = new Set<string>()
    faqs.forEach((f) => s.add(f.category || 'General'))
    return Array.from(s).sort()
  }, [faqs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return faqs.filter((f) => {
      if (category && (f.category || 'General') !== category) return false
      if (!q) return true
      return (
        f.question.toLowerCase().includes(q) ||
        (f.answer || '').toLowerCase().includes(q)
      )
    })
  }, [faqs, search, category])

  const grouped = useMemo(() => {
    const map = new Map<string, SupportFaqItem[]>()
    filtered.forEach((f) => {
      const cat = f.category || 'General'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(f)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">Help & FAQ</h1>
      <p className="mt-2 text-slate-gray">Answers about training, payments, certificates, and your account.</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions and answers..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-slate-gray">Loading FAQs…</p>
      ) : grouped.length === 0 ? (
        <p className="mt-8 text-sm text-slate-gray">No FAQs match your search.</p>
      ) : (
        <div className="mt-8 space-y-8">
          {grouped.map(([cat, items]) => (
            <section key={cat}>
              <h2 className="text-lg font-semibold text-brand-navy">{cat}</h2>
              <div className="mt-3 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
                {items.map((f) => {
                  const open = openId === f.id
                  return (
                    <div key={f.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-brand-navy hover:bg-gray-50"
                        onClick={() => setOpenId(open ? null : f.id)}
                        aria-expanded={open}
                      >
                        <span>{f.question}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open && (
                        <div className="whitespace-pre-wrap px-4 pb-4 text-sm text-slate-gray">{f.answer}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
