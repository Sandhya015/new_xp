/**
 * Full-viewport overlay used during auth flows (e.g. student login).
 * Dimmed backdrop + rotating ring around brand logo — similar UX to polished payment gateways.
 */

type Props = {
  show: boolean
  /** Screen-reader phrase; visually we still show "Loading" below the spinner */
  ariaLabel?: string
  /** Shown under the spinner (defaults to "Loading") */
  message?: string
}

export function AuthLoadingOverlay({
  show,
  ariaLabel = 'Signing you in',
  message = 'Loading',
}: Props) {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-[2px] motion-safe:backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div className="flex flex-col items-center gap-5 px-6">
        <div className="relative flex h-[5.75rem] w-[5.75rem] shrink-0 items-center justify-center">
          {/* Static soft glow behind spinner */}
          <div
            className="pointer-events-none absolute inset-[-8px] rounded-full bg-brand-accent/20 blur-md opacity-90 motion-reduce:opacity-75"
            aria-hidden
          />
          {/* Thin rotating rim — sky / white accents like gateway loaders */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-transparent border-t-sky-200 border-r-white/95 border-l-sky-300/40 shadow-[0_0_18px_rgba(125,211,252,0.55)] motion-safe:animate-spin motion-reduce:border-t-sky-200/70 motion-reduce:animate-none"
            style={{ animationDuration: '0.95s' }}
            aria-hidden
          />
          <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-black/[0.06]">
            <img
              src="/logo.png"
              alt=""
              width={72}
              height={72}
              className="h-[3rem] w-[3rem] object-contain"
              draggable={false}
            />
          </div>
        </div>
        <p className="text-[0.95rem] font-medium tracking-[0.02em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)] motion-safe:animate-pulse motion-reduce:animate-none">
          {message}
        </p>
      </div>
    </div>
  )
}
