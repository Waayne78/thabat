import { useEffect, useState, type ReactNode } from "react";

interface Props {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  /** optional second arc, e.g. share of verses learned (outer promise) vs mastered (inner truth) */
  secondary?: number;
  label?: string;
  children?: ReactNode;
}

export function ProgressRing({ value, size = 200, stroke = 14, secondary, label, children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  // animate from 0 on mount
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(1));
    return () => cancelAnimationFrame(id);
  }, []);
  const arc = (v: number) => c * (1 - (clamp(v) / 100) * shown);
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}
      role="progressbar" aria-valuenow={Math.round(clamp(value))} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progression"}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-sunken" />
        {secondary !== undefined && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
            className="stroke-m-3/60 transition-[stroke-dashoffset] duration-1000 ease-out" strokeDasharray={c} strokeDashoffset={arc(secondary)} />
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className="stroke-pine transition-[stroke-dashoffset] duration-1000 ease-out" strokeDasharray={c} strokeDashoffset={arc(value)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
