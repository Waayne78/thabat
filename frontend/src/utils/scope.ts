import type { GoalItemInput, Juz, Surah } from "@/types/api";

export interface Scope { juz: number[]; surahs: number[]; order: "mushaf" | "short_first" }
export interface ScopeSurah { id: number; name: string; firstAyahId: number; ayahIds: number[] }

const JUZ_ALIAS: Record<number, string> = { 30: "Juz' ʿAmma", 29: "Juz' Tabārak" };
export const juzName = (n: number) => JUZ_ALIAS[n] ?? `Juz' ${n}`;
export const emptyScope: Scope = { juz: [], surahs: [], order: "mushaf" };
export const scopeIsEmpty = (s: Scope) => s.juz.length + s.surahs.length === 0;

/** Goal items in learning order: ascending, or from the end when starting with the short surahs. */
export function scopeItems(s: Scope): GoalItemInput[] {
  const dir = s.order === "short_first" ? -1 : 1;
  const sorted = (xs: number[]) => [...xs].sort((a, b) => dir * (a - b));
  return [
    ...sorted(s.juz).map((j) => ({ kind: "juz" as const, ref_id: j })),
    ...sorted(s.surahs).map((id) => ({ kind: "surah" as const, ref_id: id })),
  ];
}

export function scopeTitle(s: Scope, surahs: Surah[] | undefined): string {
  const parts = [
    ...[...s.juz].sort((a, b) => b - a).map(juzName),
    ...s.surahs.map((id) => `Sourate ${surahs?.find((x) => x.id === id)?.name_translit ?? id}`),
  ];
  if (parts.length === 0) return "";
  if (parts.length <= 3) return parts.join(" + ");
  const bits = [s.juz.length ? `${s.juz.length} juz` : "", s.surahs.length ? `${s.surahs.length} sourates` : ""].filter(Boolean);
  return bits.join(" + ");
}

/** Surahs (possibly partial, at a juz boundary) covered by the selection, with their ayah ids. */
export function scopeSurahs(s: Scope, surahs: Surah[], juz: Juz[]): ScopeSurah[] {
  const ranges: [number, number][] = [
    ...s.juz.flatMap((n) => { const j = juz.find((x) => x.id === n); return j ? [[j.first_ayah_id, j.last_ayah_id] as [number, number]] : []; }),
    ...s.surahs.flatMap((id) => { const x = surahs.find((y) => y.id === id); return x ? [[x.first_ayah_id, x.first_ayah_id + x.ayah_count - 1] as [number, number]] : []; }),
  ];
  const out: ScopeSurah[] = [];
  for (const x of surahs) {
    const ayahIds: number[] = [];
    for (let i = 0; i < x.ayah_count; i++) {
      const id = x.first_ayah_id + i;
      if (ranges.some(([a, b]) => id >= a && id <= b)) ayahIds.push(id);
    }
    if (ayahIds.length) out.push({ id: x.id, name: x.name_translit, firstAyahId: x.first_ayah_id, ayahIds });
  }
  return s.order === "short_first" ? out.reverse() : out;
}

export const scopeTotal = (s: Scope, surahs: Surah[], juz: Juz[]) => scopeSurahs(s, surahs, juz).reduce((n, x) => n + x.ayahIds.length, 0);
