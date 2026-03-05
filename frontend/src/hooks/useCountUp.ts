import { useState, useEffect, useRef } from 'react'

/**
 * Animates a number from 0 to `end` over `duration` ms.
 * Uses requestAnimationFrame for smooth count-up. Starts when the ref element is in view (or on mount if no ref).
 */
export function useCountUp(
  end: number,
  duration: number = 2000,
  options: { startOnMount?: boolean } = {}
) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const { startOnMount = true } = options

  useEffect(() => {
    if (startOnMount) {
      let startTime: number
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp
        const elapsed = timestamp - startTime
        const progress = Math.min(elapsed / duration, 1)
        // easeOutQuart for a smooth slowdown at the end
        const eased = 1 - (1 - progress) ** 4
        setValue(Math.round(eased * end))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
      return () => {}
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        let startTime: number
        const step = (timestamp: number) => {
          if (!startTime) startTime = timestamp
          const elapsed = timestamp - startTime
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - (1 - progress) ** 4
          setValue(Math.round(eased * end))
          if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration, startOnMount])

  return { value, ref }
}
