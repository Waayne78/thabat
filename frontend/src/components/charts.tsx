/** Small dependency-free SVG charts, themed by the design tokens. */

export function BarChart({ data, height = 140, label }: { data: { label: string; a: number; b?: number; title?: string }[]; height?: number; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.a + (d.b ?? 0)));
  return (
    <div role="img" aria-label={label}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const ha = (d.a / max) * 100;
          const hb = ((d.b ?? 0) / max) * 100;
          return (
            <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" title={d.title ?? `${d.label} : ${d.a}`}>
              {d.b !== undefined && <div className="w-full rounded-t-md bg-state-review/55 transition-all duration-700" style={{ height: `${hb}%` }} />}
              <div className={`w-full bg-pine transition-all duration-700 ${d.b ? "" : "rounded-t-md"} ${ha + hb === 0 ? "!h-[3px] rounded-full !bg-line" : ""}`} style={{ height: `${ha}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((d, i) => <span key={i} className="flex-1 truncate text-center text-[10px] text-muted">{d.label}</span>)}
      </div>
    </div>
  );
}

export function AreaChart({ points, height = 140, label, max = 100 }: { points: (number | null)[]; height?: number; label: string; max?: number }) {
  const W = 320;
  const known = points.map((p, i) => ({ p, i })).filter((x): x is { p: number; i: number } => x.p !== null);
  if (known.length < 2) {
    return <div className="grid place-items-center text-sm text-muted" style={{ height }}>La courbe apparaîtra après quelques jours de pratique.</div>;
  }
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => height - 6 - (v / max) * (height - 12);
  const line = known.map((k, n) => `${n ? "L" : "M"}${x(k.i).toFixed(1)},${y(k.p).toFixed(1)}`).join(" ");
  const first = known[0]!;
  const last = known[known.length - 1]!;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label={label} style={{ height }}>
      <defs>
        <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgb(var(--pine))" stopOpacity=".28" />
          <stop offset="1" stopColor="rgb(var(--pine))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={y(max * g)} y2={y(max * g)} className="stroke-line" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />)}
      <path d={`${line} L${x(last.i)},${height} L${x(first.i)},${height} Z`} fill="url(#area-fill)" />
      <path d={line} fill="none" className="stroke-pine" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last.i)} cy={y(last.p)} r="4" className="fill-pine" />
    </svg>
  );
}

export function StackedBar({ parts, label }: { parts: { value: number; className: string; label: string }[]; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-sunken" role="img" aria-label={label}>
      {parts.map((p) => p.value > 0 && <div key={p.label} className={`${p.className} transition-all duration-700`} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label} : ${p.value}`} />)}
    </div>
  );
}
