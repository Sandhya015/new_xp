/**
 * Featured training images: accept JPEG/PNG uploads, normalize to 16:9 for storage/display.
 * Center-covers to 16:9, scales to up to 1920×1080 (smaller if needed to stay under 2MB), outputs JPEG.
 */

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
/** Allow larger originals; we resize on save. */
const MAX_INPUT_BYTES = 12 * 1024 * 1024
const TARGET_ASPECT = 16 / 9

const OUTPUT_SIZES = [
  { w: 1920, h: 1080 },
  { w: 1600, h: 900 },
  { w: 1280, h: 720 },
] as const

export type FeaturedImageValidationResult =
  | { ok: true }
  | { ok: false; message: string }

export type PrepareFeaturedImageResult =
  | { ok: true; file: File }
  | { ok: false; message: string }

export function isAllowedFeaturedMime(file: File): boolean {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/jpeg' || t === 'image/png') return true
  const n = file.name.toLowerCase()
  return n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png')
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('invalid image'))
    }
    img.src = url
  })
}

function coverCropSource(img: HTMLImageElement): { sx: number; sy: number; sw: number; sh: number } {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const srcAspect = w / h
  if (srcAspect > TARGET_ASPECT) {
    const sh = h
    const sw = Math.round(h * TARGET_ASPECT)
    return { sx: Math.floor((w - sw) / 2), sy: 0, sw, sh }
  }
  const sw = w
  const sh = Math.round(w / TARGET_ASPECT)
  return { sx: 0, sy: Math.floor((h - sh) / 2), sw, sh }
}

async function canvasToJpegUnderMax(
  canvas: HTMLCanvasElement,
  maxBytes: number,
  baseName: string,
): Promise<File | null> {
  let quality = 0.92
  for (let i = 0; i < 16; i++) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })
    if (blob && blob.size <= maxBytes) {
      return new File([blob], baseName, { type: 'image/jpeg' })
    }
    quality -= 0.05
    if (quality < 0.42) break
  }
  return null
}

/**
 * Reads any JPEG/PNG (up to 12MB), center-crops to 16:9, exports JPEG at 1920×1080 (or smaller if needed) under 2MB.
 */
export async function prepareFeaturedTrainingImage(file: File): Promise<PrepareFeaturedImageResult> {
  if (!isAllowedFeaturedMime(file)) {
    return { ok: false, message: 'Featured image must be JPEG or PNG.' }
  }
  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false, message: 'Featured image must be 12MB or smaller before processing.' }
  }

  let img: HTMLImageElement
  try {
    img = await loadImageFromFile(file)
  } catch {
    return { ok: false, message: 'Invalid image file.' }
  }

  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) {
    return { ok: false, message: 'Could not read image dimensions.' }
  }

  const { sx, sy, sw, sh } = coverCropSource(img)

  for (const { w: ow, h: oh } of OUTPUT_SIZES) {
    const canvas = document.createElement('canvas')
    canvas.width = ow
    canvas.height = oh
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return { ok: false, message: 'This browser cannot process images (no canvas support).' }
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh)

    const baseName = `featured-${ow}x${oh}.jpg`
    const out = await canvasToJpegUnderMax(canvas, MAX_OUTPUT_BYTES, baseName)
    if (out) return { ok: true, file: out }
  }

  return {
    ok: false,
    message: 'Could not compress the image under 2MB. Try a smaller or simpler image.',
  }
}

/** Quick checks only (mime + input size). Use {@link prepareFeaturedTrainingImage} before upload. */
export function validateFeaturedTrainingImageQuick(file: File): FeaturedImageValidationResult {
  if (!isAllowedFeaturedMime(file)) {
    return { ok: false, message: 'Featured image must be JPEG or PNG.' }
  }
  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false, message: 'Featured image must be 12MB or smaller (it will be resized to 16:9 when you save).' }
  }
  return { ok: true }
}
