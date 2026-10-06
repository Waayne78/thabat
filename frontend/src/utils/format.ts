const DAY = 86_400_000;

export const parseDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
export const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) =>
  new Intl.DateTimeFormat("fr-FR", opts).format(parseDate(iso));
export const fmtShort = (iso: string) => fmtDate(iso, { day: "numeric", month: "short" });

/** Hijri date (Umm al-Qura, calculated) — an approximation: the real month start depends on moon sighting. */
export function fmtHijri(iso: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(parseDate(iso));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const months = ["Muḥarram", "Ṣafar", "Rabīʿ I", "Rabīʿ II", "Jumādā I", "Jumādā II", "Rajab", "Shaʿbān", "Ramaḍān", "Shawwāl", "Dhū al-Qaʿda", "Dhū al-Ḥijja"];
    const month = months[get("month") - 1];
    return month ? `${get("day")} ${month} ${get("year")}` : "";
  } catch {
    return "";
  }
}

export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${String(m % 60).padStart(2, "0")}` : `${h} h`;
}

export const fmtClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Belle nuit";
  if (h < 18) return "Bonjour";
  return "Bonsoir";
}

export function relativeDue(iso: string | null, todayIso: string): string {
  if (!iso) return "—";
  const d = daysBetween(parseDate(todayIso), parseDate(iso));
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return "demain";
  return `dans ${d} jours`;
}

/** Small values keep one decimal so early progress is never shown as a flat zero. */
export const fmtPct = (v: number) => (v > 0 && v < 10 ? v.toFixed(1).replace(".", ",") : String(Math.round(v)));
