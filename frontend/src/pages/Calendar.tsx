import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorState, PageHeader, Segmented, Skeleton, StatTile } from "@/components/ui";
import { useCalendar, useToday } from "@/hooks/queries";
import type { CalendarDay } from "@/types/api";
import { addDays, fmtDate, fmtDuration, parseDate, plural, toISO } from "@/utils/format";
import { DAY_STATUS } from "@/utils/mastery";

type View = "week" | "month" | "all";
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

export default function Calendar() {
  const todayIso = useToday().data?.date ?? toISO(new Date());
  const today = parseDate(todayIso);
  const [view, setView] = useState<View>("month");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string>(todayIso);

  const range = useMemo(() => {
    if (view === "week") {
      const start = addDays(mondayOf(today), offset * 7);
      return { start, end: addDays(start, 6), title: `Semaine du ${fmtDate(toISO(start), { day: "numeric", month: "long" })}` };
    }
    if (view === "month") {
      const first = new Date(today.getFullYear(), today.getMonth() + offset, 1, 12);
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
      return { start: mondayOf(first), end: addDays(mondayOf(last), 6), title: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(first), month: first.getMonth() };
    }
    return { start: addDays(mondayOf(today), -7 * 25), end: addDays(mondayOf(today), 6), title: "Depuis le début" };
  }, [view, offset, todayIso]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError, refetch } = useCalendar(toISO(range.start), toISO(range.end));
  const picked = data?.days.find((d) => d.date === selected);
  const days = view === "all" && data?.tracking_since ? data.days.filter((d) => d.date >= toISO(mondayOf(parseDate(data.tracking_since!)))) : data?.days;
  const totals = (days ?? []).reduce((a, d) => ({ n: a.n + d.new, r: a.r + d.reviewed, s: a.s + d.seconds, active: a.active + (d.new + d.reviewed > 0 ? 1 : 0) }), { n: 0, r: 0, s: 0, active: 0 });

  return (
    <>
      <PageHeader title="Calendrier" subtitle="Ta régularité, jour après jour." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Vue" value={view} onChange={(v) => { setView(v); setOffset(0); }} options={[{ value: "week", label: "Semaine" }, { value: "month", label: "Mois" }, { value: "all", label: "Depuis le début" }]} />
        {data && <span className="chip"><Flame size={14} className="text-clay" />Série : {plural(data.streak.current, "jour")}</span>}
      </div>

      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold capitalize">{range.title}</h2>
          {view !== "all" && (
            <div className="flex gap-1">
              <button className="btn-quiet !min-h-10 !px-2.5" onClick={() => setOffset((o) => o - 1)} aria-label="Période précédente"><ChevronLeft size={20} /></button>
              <button className="btn-quiet !min-h-10 !px-2.5" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0 && view === "week"} aria-label="Période suivante"><ChevronRight size={20} /></button>
            </div>
          )}
        </div>
        {isError ? <ErrorState onRetry={() => void refetch()} /> : isLoading || !days ? <Skeleton className="h-64 w-full" /> : view === "all" ? (
          <Heatmap days={days} selected={selected} onSelect={setSelected} today={todayIso} />
        ) : (
          <>
            <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted" aria-hidden="true">{WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}</div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((d) => {
                const date = parseDate(d.date);
                const outside = view === "month" && date.getMonth() !== range.month;
                const s = DAY_STATUS[d.status];
                const filled = ["done", "partial", "review", "missed"].includes(d.status);
                return (
                  <button key={d.date} onClick={() => setSelected(d.date)} aria-pressed={selected === d.date}
                    aria-label={`${fmtDate(d.date, { weekday: "long", day: "numeric", month: "long" })} : ${s.label}`}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold tabular-nums transition ${outside ? "opacity-30" : ""} ${
                      filled ? `${s.dot} text-white` : "bg-sunken/70 text-muted"} ${d.date === todayIso ? "ring-2 ring-pine ring-offset-2 ring-offset-surface" : ""} ${selected === d.date ? "scale-105 shadow-lift" : ""}`}>
                    {date.getDate()}
                    {view === "week" && d.new + d.reviewed > 0 && <span className="text-[10px] font-medium opacity-90">{d.new}+{d.reviewed}</span>}
                    {data?.target_date === d.date && <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1.5 text-[9px] text-paper">but</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Légende">
          {(["done", "partial", "missed", "review"] as const).map((k) => <li key={k} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${DAY_STATUS[k].dot}`} />{DAY_STATUS[k].label}</li>)}
        </ul>
      </section>

      {picked && <DayDetail day={picked} />}

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 px-1 sm:grid-cols-4">
        <StatTile label="Jours actifs" value={totals.active} hint="sur la période" />
        <StatTile label="Appris" value={totals.n} hint="nouveaux versets" />
        <StatTile label="Révisés" value={totals.r} hint="récitations" />
        <StatTile label="Temps" value={fmtDuration(totals.s)} hint="de pratique" />
      </div>
    </>
  );
}

function DayDetail({ day }: { day: CalendarDay }) {
  const s = DAY_STATUS[day.status];
  const text = day.status === "future" ? "Ce jour n'est pas encore arrivé."
    : day.status === "missed" ? "Pas de session ce jour-là. Aucune importance : on reprend là où on en est."
    : day.status === "today" || day.status === "rest" ? "Aucune activité enregistrée."
    : `${plural(day.new, "verset appris", "versets appris")}${day.target_new ? ` sur ${day.target_new} prévus` : ""} · ${plural(day.reviewed, "révisé")} · ${fmtDuration(day.seconds)}`;
  return (
    <div className="card mt-4 flex animate-fade items-center gap-3 p-4" aria-live="polite">
      <span className={`h-3 w-3 shrink-0 rounded-full ${s.dot}`} />
      <div><p className="font-semibold capitalize">{fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" })}</p><p className="text-sm text-muted">{text}</p></div>
    </div>
  );
}

function Heatmap({ days, selected, onSelect, today }: { days: CalendarDay[]; selected: string; onSelect: (d: string) => void; today: string }) {
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-1">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-1">
            {w.map((d) => {
              const filled = ["done", "partial", "review", "missed"].includes(d.status);
              return <button key={d.date} onClick={() => onSelect(d.date)} title={`${fmtDate(d.date)} — ${DAY_STATUS[d.status].label}`} aria-label={`${fmtDate(d.date)} : ${DAY_STATUS[d.status].label}`}
                className={`h-5 w-5 rounded-[5px] transition sm:h-6 sm:w-6 ${filled ? DAY_STATUS[d.status].dot : d.status === "future" ? "border border-dashed border-line" : "bg-sunken"} ${d.date === today ? "ring-2 ring-pine ring-offset-1 ring-offset-surface" : ""} ${selected === d.date ? "scale-110" : ""}`} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
