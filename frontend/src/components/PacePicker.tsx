import { Check } from "lucide-react";

import type { PaceOption } from "@/types/api";
import { fmtDate, plural, toISO } from "@/utils/format";

export const RAMADAN_1448 = "2027-02-08"; // 1 Ramaḍān 1448, calculated — subject to moon sighting

const TAGLINE: Record<PaceOption["key"], string> = {
  gentle: "Le minimum pour arriver à temps", balanced: "Du temps pour consolider avant la date", intense: "Une large marge de révision",
};

const inMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return toISO(d); };

export function DatePresets({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const presets: [string, string][] = [["Dans 1 mois", inMonths(1)], ["Dans 3 mois", inMonths(3)], ["Dans 6 mois", inMonths(6)], ["Dans 1 an", inMonths(12)]];
  if (RAMADAN_1448 > toISO(new Date())) presets.push(["Ramaḍān 1448", RAMADAN_1448]);
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map(([label, iso]) => <button key={label} type="button" aria-pressed={value === iso} className={`chip ${value === iso ? "chip-on" : ""}`} onClick={() => onChange(iso)}>{label}</button>)}
    </div>
  );
}

export function PacePicker({ options, value, onChange }: { options: PaceOption[]; value: number | null; onChange: (daily: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rythme" className="space-y-2">
      {options.map((o) => {
        const on = value === o.daily_new;
        return (
          <button key={o.key} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.daily_new)}
            className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${on ? "border-pine bg-pine-soft" : "border-line bg-surface hover:bg-sunken/60"}`}>
            <div className="w-16 shrink-0 text-center">
              <div className="text-3xl font-semibold leading-none tabular-nums">{o.daily_new}</div>
              <div className="mt-1 text-[11px] text-muted">versets / jour</div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold">{o.label}{o.recommended && <span className="rounded-full bg-pine px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pine-on">Recommandé</span>}</p>
              <p className="text-sm text-muted">{TAGLINE[o.key]}</p>
              <p className="mt-1 text-xs text-muted">≈ {o.minutes_per_day} min/jour · fin le {fmtDate(o.finish_date, { day: "numeric", month: "short" })} · marge {plural(Math.max(0, o.margin_days), "jour")}</p>
            </div>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${on ? "border-pine bg-pine text-pine-on" : "border-line"}`}>{on && <Check size={14} />}</span>
          </button>
        );
      })}
    </div>
  );
}
