type ConsoleBrandMarkProps = {
  subtitle: string
  /** sm = sidebar, md = login panel, lg = hero */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: { icon: 'h-11 w-11', title: 'text-base', sub: 'text-[10px] tracking-[0.2em]' },
  md: { icon: 'h-12 w-12', title: 'text-xl', sub: 'text-[11px] tracking-[0.18em]' },
  lg: { icon: 'h-16 w-16', title: 'text-2xl', sub: 'text-xs tracking-[0.2em]' },
}

export function ConsoleBrandMark({ subtitle, size = 'sm', className = '' }: ConsoleBrandMarkProps) {
  const s = sizeMap[size]
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <img
        src="/favicon.png"
        alt=""
        className={`shrink-0 object-contain ${s.icon}`}
        aria-hidden
      />
      <div className="min-w-0 leading-tight">
        <p className={`font-bold text-white ${s.title}`}>
          Xpert<span className="text-sky-300">Intern</span>
        </p>
        <p className={`font-semibold uppercase text-white/50 ${s.sub}`}>{subtitle}</p>
      </div>
    </div>
  )
}
