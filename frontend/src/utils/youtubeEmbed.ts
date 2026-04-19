/**
 * YouTube watch / share URLs → embed URL for iframes. Supports optional start time (?t=680s, &start=…).
 */

function parseYoutubeStartSeconds(u: URL): number | undefined {
  const start = u.searchParams.get('start')
  if (start && /^\d+$/.test(start)) return parseInt(start, 10)
  const t = (u.searchParams.get('t') || '').trim()
  const secOnly = t.match(/^(\d+)s?$/i)
  if (secOnly) return parseInt(secOnly[1], 10)
  const hm = t.match(/^(\d+)h(?:(\d+)m)?(?:(\d+)s?)?$/i)
  if (hm) {
    const h = parseInt(hm[1], 10) || 0
    const m = hm[2] != null ? parseInt(hm[2], 10) || 0 : 0
    const s = hm[3] != null ? parseInt(String(hm[3]).replace(/s$/i, ''), 10) || 0 : 0
    return h * 3600 + m * 60 + s
  }
  const ms = t.match(/^(\d+)m(?:(\d+)s?)?$/i)
  if (ms) {
    const m = parseInt(ms[1], 10) || 0
    const s = ms[2] != null ? parseInt(String(ms[2]).replace(/s$/i, ''), 10) || 0 : 0
    return m * 60 + s
  }
  return undefined
}

export function getYoutubeEmbedUrl(url: string): string | null {
  const raw = (url || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    let vid: string | null = null
    let start: number | undefined

    if (u.hostname === 'youtu.be' || u.hostname.endsWith('.youtu.be')) {
      vid = u.pathname.replace(/^\//, '').split('/')[0] || null
      start = parseYoutubeStartSeconds(u)
    } else if (u.hostname.includes('youtube.com')) {
      vid = u.searchParams.get('v')
      if (!vid) {
        const m = u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)
        if (m?.[1]) vid = m[1]
      }
      start = parseYoutubeStartSeconds(u)
    }
    if (!vid) return null
    const base = `https://www.youtube.com/embed/${encodeURIComponent(vid)}`
    return start != null && start > 0 ? `${base}?start=${start}` : base
  } catch {
    return null
  }
}

/** Standard watch URL for opening the same video on youtube.com (new tab). */
export function getYoutubeWatchUrl(url: string): string | null {
  const raw = (url || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.hostname === 'youtu.be' || u.hostname.endsWith('.youtu.be')) {
      const vid = u.pathname.replace(/^\//, '').split('/')[0]
      return vid ? `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}` : null
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/watch?v=${encodeURIComponent(v)}`
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)
      if (m?.[1]) return `https://www.youtube.com/watch?v=${encodeURIComponent(m[1])}`
    }
  } catch {
    return null
  }
  return null
}
