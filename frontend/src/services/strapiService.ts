/**
 * Strapi REST client for the Article collection type.
 * Configure Strapi URL via VITE_STRAPI_URL (e.g. http://localhost:1337).
 * Strapi admin: Settings → Roles → Public → allow article find & findOne.
 */

import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

const DEFAULT_STRAPI_ORIGIN = 'http://localhost:1337'

/** True if string looks like HTML from Strapi / editors, not Markdown. */
function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][a-z0-9]*[\s/>]/i.test(s)
}

/** Common in pasted Markdown: `** Introduction**` — tighten so parsers see `**Introduction**`. */
function normalizeMarkdownBoldLineStarts(md: string): string {
  return md.replace(/^(\s*)\*\*\s+/gm, '$1**')
}

function markdownToHtml(md: string): string {
  const src = normalizeMarkdownBoldLineStarts(md.trim())
  const out = marked.parse(src, { async: false }) as string
  return out.trim()
}

function markdownInlineToHtml(fragment: string): string {
  const src = normalizeMarkdownBoldLineStarts(fragment)
  return marked.parseInline(src, { async: false }) as string
}

export function getStrapiOrigin(): string {
  const fromEnv = import.meta.env.VITE_STRAPI_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return DEFAULT_STRAPI_ORIGIN
}

/**
 * Strapi may return `/uploads/...` or absolute URLs saved when `server.url` differed (e.g. old deploy URL).
 * Always resolve through the configured API origin so the blog keeps working after refresh / domain changes.
 */
function resolveStrapiAssetUrl(raw: string | null | undefined, origin: string): string | null {
  if (raw == null || typeof raw !== 'string') return null
  const u = raw.trim()
  if (!u) return null
  const base = origin.replace(/\/$/, '')
  if (u.startsWith('/')) return `${base}${u}`
  try {
    const parsed = new URL(u)
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`
    if (path.startsWith('/uploads/') || path.startsWith('/upload/')) {
      return `${base}${path}`
    }
    return u
  } catch {
    return `${base}/${u.replace(/^\//, '')}`
  }
}

export type StrapiArticle = {
  id: number
  slug: string
  title: string
  descriptionHtml: string
  excerptPlain: string
  category: string
  readTime: number
  publishedDate: string | null
  coverImageUrl: string | null
}

type UnknownRecord = Record<string, unknown>

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null
}

function numericEntryId(raw: UnknownRecord): number {
  const n = typeof raw.id === 'number' ? raw.id : Number(raw.id)
  if (Number.isFinite(n)) return n
  const doc = raw.documentId
  if (typeof doc === 'string' && doc.length > 0) {
    let h = 0
    for (let i = 0; i < doc.length; i++) h = (Math.imul(31, h) + doc.charCodeAt(i)) | 0
    return Math.abs(h)
  }
  return 0
}

/** Strapi v4: { id, attributes }. v5+: flat fields on the row */
function unwrapEntry(raw: unknown): { id: number; fields: UnknownRecord } | null {
  if (!isRecord(raw)) return null
  if ('attributes' in raw && isRecord(raw.attributes)) {
    const id = numericEntryId(raw)
    if (!id) return null
    return { id, fields: raw.attributes }
  }
  const id = numericEntryId(raw)
  if (!id) return null
  return { id, fields: raw }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function mediaUrl(fields: UnknownRecord, origin: string): string | null {
  const cover = fields.coverImage
  if (!isRecord(cover)) return null
  // Strapi 5: populated media object with url / formats
  const flat = pickMediaUrl(cover, origin)
  if (flat) return flat
  // v4: coverImage.data.attributes.url
  const data = cover.data
  if (isRecord(data)) {
    if (data.attributes && isRecord(data.attributes)) {
      const u = pickMediaUrl(data.attributes, origin)
      if (u) return u
    }
    const u = pickMediaUrl(data, origin)
    if (u) return u
  }
  return null
}

/** Strip HTML for excerpts; keep word boundaries (avoids IntroductionInternships). */
function htmlToPlainText(html: string): string {
  if (!html.trim()) return ''
  const step = html
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|blockquote|li|ul|ol|section|article|figure)\b[^>]*>/gi, ' ')
    .replace(/<(p|div|h[1-6]|blockquote)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  return step
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlinePlain(nodes: unknown[] | undefined): string {
  if (!nodes?.length) return ''
  return nodes
    .map((n) => {
      if (!isRecord(n)) return ''
      const t = str(n.type)
      if (t === 'text') return str(n.text)
      if (t === 'link') return inlinePlain(Array.isArray(n.children) ? n.children : [])
      return inlinePlain(Array.isArray(n.children) ? n.children : [])
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Block-aware plain text so headings / paragraphs don’t glue words together. */
function blockToPlain(node: unknown): string {
  if (!isRecord(node)) return ''
  const t = str(node.type)
  const children = Array.isArray(node.children) ? node.children : []
  if (t === 'paragraph' || t === 'heading') return inlinePlain(children)
  if (t === 'list') {
    return children
      .filter((c) => isRecord(c) && str(c.type) === 'list-item')
      .map((li) => blockToPlain(li))
      .filter(Boolean)
      .join(' ')
  }
  if (t === 'list-item') return inlinePlain(children)
  if (t === 'quote') return inlinePlain(children)
  if (t === 'code') return typeof node.plainText === 'string' ? node.plainText : inlinePlain(children)
  return children.map(blockToPlain).filter(Boolean).join(' ')
}

function blocksToPlainText(nodes: unknown[]): string {
  return nodes
    .map(blockToPlain)
    .filter(Boolean)
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Section titles — card/list previews stop before these (keeps “Introduction” only). */
const EXCERPT_CUT_BEFORE: RegExp[] = [
  /\s+why\s+internships\s+matter\b/i,
  /\s+what\s+(?:our\s+)?partner\b/i,
  /\s+skill\s+development\b/i,
  /\s+career\s+opportunities\b/i,
  /\s+conclusion\b/i,
  /\s+summary\b/i,
  /\s+key\s+takeaways?\b/i,
  /\s+final\s+thoughts?\b/i,
]

function clipExcerptToIntroduction(plain: string): string {
  let s = plain.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim()
  // Drop duplicate section label when it’s a standalone heading (e.g. "Introduction Internships play…")
  s = s.replace(/^introduction\s+(?=[A-Z][a-z]{2,}\b)/i, '').trim()
  for (const re of EXCERPT_CUT_BEFORE) {
    const idx = s.search(re)
    if (idx >= 24) {
      s = s.slice(0, idx).trim()
      break
    }
  }
  return s.trim()
}

function finalizeExcerpt(plain: string, maxLen = 220): string {
  const clipped = clipExcerptToIntroduction(plain)
  let s = clipped
  if (s.length > maxLen) {
    s = s.slice(0, maxLen)
    const lastSp = s.lastIndexOf(' ')
    if (lastSp > maxLen * 0.55) s = s.slice(0, lastSp)
    s = `${s.trimEnd()}…`
  }
  if (s.length > 0) return s
  const fallback = plain.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim()
  return fallback.length > maxLen ? `${fallback.slice(0, maxLen).trim()}…` : fallback
}

/**
 * Strapi 5 rich text is often a Blocks JSON array, not an HTML string.
 * Also accepts legacy HTML strings from Strapi 4 or plain text.
 */
function richTextToHtml(value: unknown, origin: string): string {
  if (value == null) return ''
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return ''
    if (looksLikeHtml(s)) return s
    return markdownToHtml(s)
  }
  let blocks: unknown[] | null = null
  if (Array.isArray(value)) blocks = value
  else if (isRecord(value) && isRecord(value.root) && Array.isArray(value.root.children)) {
    blocks = value.root.children as unknown[]
  }
  if (!blocks?.length) return ''

  const inline = (nodes: unknown[] | undefined): string => {
    if (!nodes?.length) return ''
    return nodes
      .map((n) => {
        if (!isRecord(n)) return ''
        const t = str(n.type)
        if (t === 'text') {
          const rawText = str(n.text)
          const hasMarkdown = /(\*\*|__|~~|`|\[[^\]]*\]\([^)]*\))/.test(rawText)
          if (hasMarkdown && !looksLikeHtml(rawText)) {
            return markdownInlineToHtml(rawText)
          }
          let out = escapeHtml(rawText)
          if (n.bold) out = `<strong>${out}</strong>`
          if (n.italic) out = `<em>${out}</em>`
          if (n.underline) out = `<u>${out}</u>`
          if (n.strikethrough) out = `<s>${out}</s>`
          if (n.code) out = `<code>${out}</code>`
          return out
        }
        if (t === 'link') {
          const href = escapeHtml(str(n.url))
          const inner = inline(Array.isArray(n.children) ? n.children : [])
          return `<a href="${href}" rel="noopener noreferrer" target="_blank">${inner}</a>`
        }
        return inline(Array.isArray(n.children) ? n.children : [])
      })
      .join('')
  }

  const block = (node: unknown): string => {
    if (!isRecord(node)) return ''
    const t = str(node.type)
    const children = Array.isArray(node.children) ? node.children : []

    if (t === 'paragraph') return `<p>${inline(children)}</p>`
    if (t === 'heading') {
      const level = Math.min(6, Math.max(1, num(node.level) ?? 2))
      return `<h${level}>${inline(children)}</h${level}>`
    }
    if (t === 'list') {
      const tag = node.format === 'ordered' ? 'ol' : 'ul'
      const items = children
        .filter((c) => isRecord(c) && str(c.type) === 'list-item')
        .map((li) => {
          const ic = isRecord(li) && Array.isArray(li.children) ? li.children : []
          const inner = ic.map((c) => block(c)).join('')
          return `<li>${inner}</li>`
        })
        .join('')
      return `<${tag}>${items}</${tag}>`
    }
    if (t === 'list-item') return children.map((c) => block(c)).join('')
    if (t === 'quote') return `<blockquote>${inline(children)}</blockquote>`
    if (t === 'code') {
      const plain = typeof node.plainText === 'string' ? node.plainText : inline(children)
      return `<pre><code>${escapeHtml(plain)}</code></pre>`
    }
    if (t === 'image') {
      const img = node.image
      if (isRecord(img)) {
        const u = str(img.url)
        const full = resolveStrapiAssetUrl(u, origin)
        if (!full) return ''
        const alt = escapeHtml(str(img.alternativeText))
        return `<figure><img src="${escapeHtml(full)}" alt="${alt}" loading="lazy" /></figure>`
      }
    }
    return children.map((c) => block(c)).join('')
  }

  return blocks.map((b) => block(b)).join('\n')
}

function richTextToExcerpt(value: unknown, htmlFallback: string): string {
  let raw: string
  if (Array.isArray(value)) raw = blocksToPlainText(value)
  else if (isRecord(value) && isRecord(value.root) && Array.isArray(value.root.children)) {
    raw = blocksToPlainText(value.root.children as unknown[])
  } else {
    raw = htmlToPlainText(htmlFallback)
  }
  return finalizeExcerpt(raw, 220)
}

function pickMediaUrl(media: UnknownRecord, origin: string): string | null {
  const direct = str(media.url)
  if (direct) return resolveStrapiAssetUrl(direct, origin)
  const formats = media.formats
  if (isRecord(formats)) {
    for (const k of ['large', 'medium', 'small', 'thumbnail'] as const) {
      const f = formats[k]
      if (isRecord(f)) {
        const u = str(f.url)
        const resolved = resolveStrapiAssetUrl(u, origin)
        if (resolved) return resolved
      }
    }
  }
  return null
}

function normalizeArticle(entry: unknown, origin: string): StrapiArticle | null {
  const un = unwrapEntry(entry)
  if (!un) return null
  const { id, fields } = un
  const slug = str(fields.slug).trim()
  const title = str(fields.title).trim()
  if (!slug || !title) return null

  const rawDesc = fields.description
  const descriptionHtml = richTextToHtml(rawDesc, origin)
  const excerptPlain = richTextToExcerpt(rawDesc, descriptionHtml)
  const category = str(fields.category).trim() || 'General'
  const readTime = num(fields.readTime) ?? 5
  const publishedRaw = fields.publishedAt ?? fields.publishedDate
  const publishedDate =
    typeof publishedRaw === 'string' && publishedRaw.trim() ? publishedRaw : null

  return {
    id,
    slug,
    title,
    descriptionHtml,
    excerptPlain,
    category,
    readTime,
    publishedDate,
    coverImageUrl: mediaUrl(fields, origin),
  }
}

type StrapiListResponse = { data?: unknown[] }

async function parseList(res: Response): Promise<StrapiArticle[]> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Strapi request failed (${res.status})`)
  }
  const json = (await res.json()) as StrapiListResponse
  const origin = getStrapiOrigin()
  const rows = Array.isArray(json.data) ? json.data : []
  return rows.map((row) => normalizeArticle(row, origin)).filter((a): a is StrapiArticle => a != null)
}

/** Lean list: only coverImage (not populate=*); caps page size. Public role should still hide drafts. */
function articlesListUrl(origin: string): string {
  const url = new URL('/api/articles', origin)
  url.searchParams.set('populate[coverImage]', 'true')
  url.searchParams.set('sort', 'publishedDate:desc')
  url.searchParams.set('pagination[pageSize]', '30')
  return url.toString()
}

/** Single article: full populate for richtext / nested media in body (one document — acceptable cost). */
function articleBySlugUrl(origin: string, slug: string): string {
  const url = new URL('/api/articles', origin)
  url.searchParams.set('populate', '*')
  url.searchParams.set('filters[slug][$eq]', slug)
  return url.toString()
}

const ARTICLES_CACHE_TTL_MS = 45_000
type ArticlesCache = { origin: string; exp: number; data: StrapiArticle[] }
let articlesCache: ArticlesCache | null = null

export function invalidateStrapiArticlesCache(): void {
  articlesCache = null
}

export const strapiService = {
  async getArticles(): Promise<StrapiArticle[]> {
    const origin = getStrapiOrigin()
    const now = Date.now()
    if (articlesCache && articlesCache.origin === origin && now < articlesCache.exp) {
      return articlesCache.data
    }
    const res = await fetch(articlesListUrl(origin), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    const data = await parseList(res)
    articlesCache = { origin, exp: now + ARTICLES_CACHE_TTL_MS, data }
    return data
  },

  async getArticleBySlug(slug: string): Promise<StrapiArticle | null> {
    const origin = getStrapiOrigin()
    const res = await fetch(articleBySlugUrl(origin, slug), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    const list = await parseList(res)
    return list[0] ?? null
  },
}
