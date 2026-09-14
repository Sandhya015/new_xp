import { createRoot } from 'react-dom/client'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { CertificateDocument } from '@/components/certificate/CertificateDocument'
import type { CertificateDisplayData } from '@/lib/certificateFormat'

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

async function waitForImages(container: HTMLElement, timeoutMs = 10000): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'))
  if (images.length === 0) return

  await Promise.race([
    Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve()
              return
            }
            const done = () => {
              img.removeEventListener('load', done)
              img.removeEventListener('error', done)
              resolve()
            }
            img.addEventListener('load', done)
            img.addEventListener('error', done)
          })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

export type CertificatePdfOptions = {
  filename?: string
  showSignature?: boolean
}

/** Render certificate React layout off-screen and export as PDF (single A4 page). */
export async function buildCertificatePdfBlob(
  data: CertificateDisplayData,
  options?: CertificatePdfOptions
): Promise<Blob> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.position = 'fixed'
  host.style.left = '-14000px'
  host.style.top = '0'
  host.style.zIndex = '-1'
  host.style.background = '#ffffff'
  host.style.width = `${A4_WIDTH_MM}mm`
  document.body.appendChild(host)

  const root = createRoot(host)
  root.render(<CertificateDocument data={data} showSignature={options?.showSignature ?? true} />)

  try {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    await waitForImages(host)
    await new Promise<void>((r) => setTimeout(r, 120))

    const page = host.querySelector('[data-certificate-page]') as HTMLElement | null
    if (!page) throw new Error('Certificate layout failed to render')

    const canvas = await html2canvas(page, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: page.offsetWidth,
      height: page.offsetHeight,
      windowWidth: page.offsetWidth,
      windowHeight: page.offsetHeight,
      scrollX: 0,
      scrollY: 0,
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.94)
    const aspect = canvas.height / canvas.width
    let pdfWidth = A4_WIDTH_MM
    let pdfHeight = pdfWidth * aspect

    if (pdfHeight > A4_HEIGHT_MM) {
      pdfHeight = A4_HEIGHT_MM
      pdfWidth = pdfHeight / aspect
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [A4_WIDTH_MM, A4_HEIGHT_MM],
    })
    const x = (A4_WIDTH_MM - pdfWidth) / 2
    const y = 0
    pdf.addImage(imgData, 'JPEG', x, y, pdfWidth, pdfHeight)
    return pdf.output('blob')
  } finally {
    root.unmount()
    host.remove()
  }
}

export async function downloadCertificatePdf(
  data: CertificateDisplayData,
  options?: CertificatePdfOptions
): Promise<void> {
  const blob = await buildCertificatePdfBlob(data, options)
  const certId = (data.certificateId || 'certificate').replace(/[^\w-]+/g, '_')
  const filename = options?.filename || `XpertIntern-${certId}.pdf`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
