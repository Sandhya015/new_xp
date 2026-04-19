/**
 * Client-side validation for training featured images: 16:9, min 1280×720, max 2MB, JPEG/PNG.
 */

const MAX_BYTES = 2 * 1024 * 1024
const MIN_W = 1280
const MIN_H = 720
const ASPECT = 16 / 9
const TOLERANCE = 0.02

export type FeaturedImageValidationResult =
  | { ok: true }
  | { ok: false; message: string }

function allowedMime(file: File): boolean {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/jpeg' || t === 'image/png') return true
  const n = file.name.toLowerCase()
  return n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png')
}

export function validateFeaturedTrainingImage(file: File): Promise<FeaturedImageValidationResult> {
  return new Promise((resolve) => {
    if (!allowedMime(file)) {
      resolve({ ok: false, message: 'Featured image must be JPEG or PNG.' })
      return
    }
    if (file.size > MAX_BYTES) {
      resolve({ ok: false, message: 'Featured image must be 2MB or smaller.' })
      return
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (!w || !h) {
        resolve({ ok: false, message: 'Could not read image dimensions.' })
        return
      }
      const ratio = w / h
      if (Math.abs(ratio - ASPECT) / ASPECT > TOLERANCE) {
        resolve({
          ok: false,
          message: 'Please upload a 16:9 image (1920×1080px recommended, minimum 1280×720).',
        })
        return
      }
      if (w < MIN_W || h < MIN_H) {
        resolve({
          ok: false,
          message: 'Minimum size is 1280×720 pixels (16:9).',
        })
        return
      }
      resolve({ ok: true })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ ok: false, message: 'Invalid image file.' })
    }
    img.src = url
  })
}
