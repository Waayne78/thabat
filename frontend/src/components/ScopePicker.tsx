import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Segmented, Skeleton } from "@/components/ui";
import { useJuz, useSurahs } from "@/hooks/queries";
import { juzName, scopeTotal, type Scope } from "@/utils/scope";

const toggle = (xs: number[], x: number) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/** Free choice of what to memorise: any juz, any surahs, in the order the learner prefers. */
export function ScopePicker({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const surahs = useSurahs();
  const juz = useJuz();
  const [tab, setTab] = useState<"juz" | "surah">(value.surahs.length && !value.juz.length ? "surah" : "juz");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (surahs.data ?? []).filter((s) => !q || s.name_translit.toLowerCase().includes(q) || String(s.id) === q);
  }, [surahs.data, query]);
  const total = surahs.data && juz.data ? scopeTotal(value, surahs.data, juz.data) : 0;

  if (surahs.isLoading || juz.isLoading) return <div className="space-y-2"><Skeleton className="h-10 w-48" /><Skeleton className="h-56" /></div>;
  return (
    <div>
      <Segmented label="Choisir par" value={tab} onChange={setTab} options={[{ value: "juz", label: `Par juz${value.juz.length ? ` (${value.juz.length})` : ""}` }, { value: "surah", label: `Par sourate${value.surahs.length ? ` (${value.surahs.length})` : ""}` }]} />

      {tab === "juz" ? (
        <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-6" role="group" aria-label="Juz à mémoriser">
          {(juz.data ?? []).map((j) => {
            const on = value.juz.includes(j.id);
            return (
              <button key={j.id} type="button" aria-pressed={on} aria-label={`${juzName(j.id)}, ${j.ayah_count} versets`} onClick={() => onChange({ ...value, juz: toggle(value.juz, j.id) })}
                className={`flex h-14 flex-col items-center justify-center rounded-xl border text-sm transition ${on ? "border-pine bg-pine text-pine-on" : "border-line bg-surface hover:border-muted"}`}>
                <span className="font-semibold tabular-nums">{j.id}</span>
                <span className={`text-[10px] tabular-nums ${on ? "opacity-80" : "text-muted"}`}>{j.ayah_count} v.</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field !pl-10" placeholder="Rechercher une sourate" aria-label="Rechercher une sourate" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface" aria-label="Sourates à mémoriser">
            {filtered.map((s) => {
              const on = value.surahs.includes(s.id);
              return (
                <li key={s.id}>
                  <button type="button" role="checkbox" aria-checked={on} onClick={() => onChange({ ...value, surahs: toggle(value.surahs, s.id) })} className="flex min-h-11 w-full items-center gap-3 px-3.5 text-left text-sm hover:bg-sunken/60">
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? "border-pine bg-pine text-pine-on" : "border-line"}`}>{on && <Check size={13} />}</span>
                    <span className="w-7 tabular-nums text-muted">{s.id}</span>
                    <span className="flex-1 font-medium">{s.name_translit}</span>
                    <span className="tabular-nums text-muted">{s.ayah_count} v.</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-3.5 py-4 text-sm text-muted">Aucune sourate ne correspond.</li>}
          </ul>
        </div>
      )}

      <p className="mt-3 text-sm text-muted" aria-live="polite">{total ? <><span className="font-semibold text-ink tabular-nums">{total} versets</span> sélectionnés</> : "Sélectionne au moins un juz ou une sourate."}</p>

      <div className="mt-4">
        <span className="label">Ordre d'apprentissage</span>
        <Segmented label="Ordre d'apprentissage" value={value.order} onChange={(order) => onChange({ ...value, order })} options={[{ value: "mushaf", label: "Dans l'ordre du muṣḥaf" }, { value: "short_first", label: "En partant de la fin" }]} />
      </div>
    </div>
  );
}
