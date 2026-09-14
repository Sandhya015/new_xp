import { CERTIFICATE_SIGNATORY_BLOCK_SRC } from '@/lib/certificateFormat'

type Props = {
  showSignature?: boolean
  className?: string
}

/** Single official signatory image (signature + stamp + name lines). */
export function SignatoryBlock({ showSignature = true, className = '' }: Props) {
  if (!showSignature) {
    return <div className={className} style={{ width: '56mm', minHeight: '28mm' }} aria-hidden />
  }

  return (
    <div className={`shrink-0 flex justify-end items-start ${className}`}>
      <img
        src={CERTIFICATE_SIGNATORY_BLOCK_SRC}
        alt="Om Raj, Founder & CEO, Xpert Ventures Private Limited"
        className="block object-contain object-right"
        style={{ width: '56mm', height: 'auto' }}
        crossOrigin="anonymous"
        decoding="sync"
      />
    </div>
  )
}
