/**
 * Client-side HTML sanitizer for admin-authored rich text (no script/on*).
 * Keeps common TipTap tags only.
 */
const MAX_HTML_LEN = 600_000

/** TipTap StarterKit + common paste shapes; unknown tags are unwrapped (text kept). */
const ALLOWED = new Set([
  'P',
  'BR',
  'STRONG',
  'EM',
  'B',
  'I',
  'U',
  'S',
  'STRIKE',
  'DEL',
  'UL',
  'OL',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'BLOCKQUOTE',
  'A',
  'SPAN',
  'DIV',
  'CODE',
  'PRE',
  'HR',
])

const FORBIDDEN = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'STYLE', 'LINK', 'META', 'SVG', 'BASE'])

export function plainTextFromHtml(html: string): string {
  if (!html) return ''
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const d = document.createElement('div')
  d.innerHTML = html
  return (d.textContent || '').replace(/\s+/g, ' ').trim()
}

/** Public catalog / cards: prefer shortDescription, strip tags so `<p>…</p>` never shows as raw HTML. */
export function courseListingBlurb(
  shortDescription: string | undefined | null,
  description: string | undefined | null,
): string {
  const raw = (shortDescription || description || '').trim()
  if (!raw) return ''
  return plainTextFromHtml(raw).replace(/\s+/g, ' ').trim()
}

function sanitizeNode(node: Node): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    const tag = el.tagName
    if (FORBIDDEN.has(tag)) {
      el.remove()
      return
    }
    if (!ALLOWED.has(tag)) {
      const parent = el.parentNode
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
      return
    }
    if (tag === 'A') {
      const href = el.getAttribute('href') || ''
      if (!/^https?:\/\//i.test(href)) {
        el.removeAttribute('href')
      }
      el.removeAttribute('onclick')
    }
    const attrs = [...el.attributes]
    for (const attr of attrs) {
      const n = attr.name.toLowerCase()
      if (n.startsWith('on') || n === 'style' || n === 'id') el.removeAttribute(attr.name)
    }
  }
  const children = [...node.childNodes]
  for (const ch of children) sanitizeNode(ch)
}

export function sanitizeRichHtml(html: string): string {
  if (!html) return ''
  if (typeof window === 'undefined') {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').slice(0, MAX_HTML_LEN)
  }
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    sanitizeNode(doc.body)
    let out = doc.body.innerHTML
    if (out.length > MAX_HTML_LEN) out = out.slice(0, MAX_HTML_LEN)
    return out
  } catch {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').slice(0, MAX_HTML_LEN)
  }
}
