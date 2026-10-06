import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { ScopeSurah } from "@/utils/scope";

interface Props {
  surahs: ScopeSurah[];
  value: Set<number>;
  onChange: (v: Set<number>) => void;
  /** ayahs that already have a memorisation state and cannot be declared again */
  locked?: Set<number>;
}

/** Tick whole surahs, or open one to tick individual verses. */
export function KnownPicker({ surahs, value, onChange, locked }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const free = (s: ScopeSurah) => s.ayahIds.filter((i) => !locked?.has(i));
  const set = (ids: number[], on: boolean) => {
    const next = new Set(value);
    ids.forEach((i) => (on ? next.add(i) : next.delete(i)));
    onChange(next);
  };

  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {surahs.map((s) => {
        const ids = free(s);
        const picked = ids.filter((i) => value.has(i)).length;
        const lockedCount = s.ayahIds.length - ids.length;
        const all = ids.length > 0 && picked === ids.length;
        return (
          <li key={s.id}>
            <div className="flex min-h-12 items-center gap-3 px-3.5">
              <input type="checkbox" className="h-5 w-5 shrink-0 accent-[rgb(var(--pine))]" checked={all} disabled={ids.length === 0}
                ref={(el) => { if (el) el.indeterminate = picked > 0 && !all; }}
                onChange={(e) => set(ids, e.target.checked)} aria-label={`Je connais toute la sourate ${s.name}`} />
              <button type="button" className="flex min-h-12 flex-1 items-center gap-2 text-left text-sm" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id} aria-label={`Choisir des versets de ${s.name}`}>
                <span className="w-7 tabular-nums text-muted">{s.id}</span>
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="tabular-nums text-muted">{picked + lockedCount}/{s.ayahIds.length}</span>
                <ChevronDown size={16} className={`text-muted transition ${open === s.id ? "rotate-180" : ""}`} />
              </button>
            </div>
            {open === s.id && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 border-t border-line bg-sunken/40 p-3">
                {s.ayahIds.map((id) => {
                  const isLocked = locked?.has(id) ?? false;
                  const on = value.has(id);
                  const number = id - s.firstAyahId + 1;
                  return (
                    <button key={id} type="button" disabled={isLocked} aria-pressed={on || isLocked} aria-label={`Verset ${number}${isLocked ? ", déjà suivi" : ""}`} onClick={() => set([id], !on)}
                      className={`grid aspect-square place-items-center rounded-md border text-xs font-medium tabular-nums transition ${isLocked ? "border-transparent bg-m-3 text-ink opacity-60" : on ? "border-pine bg-pine text-pine-on" : "border-line bg-surface text-muted hover:border-muted"}`}>
                      {number}
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
