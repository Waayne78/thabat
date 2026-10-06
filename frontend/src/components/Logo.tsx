/** The mark: an open ring (the path still being walked) around a fixed point (what is anchored). */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M32 8a24 24 0 1 0 24 24" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="7" className="fill-clay" />
    </svg>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-pine">
      <LogoMark size={size} />
      <span className="text-[1.25em] font-bold tracking-tight text-ink">Thabāt</span>
    </span>
  );
}
