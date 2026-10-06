
import { AchievementIcon } from "@/components/AchievementIcon";
import { AreaChart, BarChart } from "@/components/charts";
import { ErrorState, PageHeader, PageSkeleton, StatTile } from "@/components/ui";
import { useAchievements, useStatistics } from "@/hooks/queries";
import { fmtDate, fmtDuration, fmtShort, plural } from "@/utils/format";

export default function Journey() {
  const stats = useStatistics();
  const ach = useAchievements();
  if (stats.isLoading || ach.isLoading) return <PageSkeleton />;
  if (stats.isError || !stats.data || !ach.data) return <ErrorState onRetry={() => { void stats.refetch(); void ach.refetch(); }} />;
  const s = stats.data;
  const { level, levels, achievements } = ach.data;
  const weekDelta = s.this_week.new - s.last_week.new;
  const firstUse = s.learned === 0 && s.reviews === 0;

  return (
    <>
      <PageHeader title="Parcours" subtitle="Statistiques, niveaux et étapes." />

      <section className="card p-5" aria-labelledby="level-title">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">Niveau {level.level}</p>
            <h2 id="level-title" className="mt-1 text-2xl font-semibold">{level.name}</h2>
          </div>
          <span className="rounded-full bg-pine-soft px-3 py-1 text-sm font-semibold text-pine tabular-nums">{Math.round(level.points)} versets ancrés</span>
        </div>
        <ol className="mt-5 grid grid-cols-5 gap-1.5">
          {levels.map((l) => (
            <li key={l.level}>
              <div className={`h-1.5 rounded-full ${l.level < level.level ? "bg-pine" : l.level === level.level ? "bg-sunken" : "bg-sunken"}`}>
                {l.level === level.level && <div className="h-full rounded-full bg-pine transition-all duration-1000" style={{ width: `${Math.max(4, level.progress_pct)}%` }} />}
              </div>
              <p className={`mt-1.5 text-[10px] leading-tight sm:text-xs ${l.level === level.level ? "font-semibold text-ink" : "text-muted"}`}>{l.name}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          {level.next_threshold ? `Encore ${Math.max(1, Math.ceil(level.next_threshold - level.points))} versets ancrés pour devenir « ${level.next_name} ».` : "Dernier palier atteint."}
          {" "}Un verset ancré = un verset maîtrisé à 100 %.
        </p>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 px-1 sm:grid-cols-3">
        <StatTile label="Versets appris" value={s.learned} hint={`${s.daily_average} / jour en moyenne`} />
        <StatTile label="Maîtrisés" value={s.mastered} hint={`taux de maîtrise ${Math.round(s.mastery_rate)} %`} />
        <StatTile label="Révisions" value={s.reviews} hint="récitations de consolidation" />
        <StatTile label="Temps passé" value={fmtDuration(s.seconds)} hint={plural(s.active_days, "jour actif", "jours actifs")} />
        <StatTile label="Meilleure série" value={s.best_streak} hint={`série actuelle : ${s.current_streak}`} />
        <StatTile label="Meilleure journée" value={s.best_day ? s.best_day.new + s.best_day.reviewed : "—"} hint={s.best_day ? `récitations · ${fmtDate(s.best_day.date, { day: "numeric", month: "long" })}` : "à venir"} />
      </div>

      <section className="card mt-6 p-5" aria-labelledby="weekly-title">
        <h2 id="weekly-title" className="text-lg font-semibold">Progression hebdomadaire</h2>
        {!firstUse && <p className={`text-sm font-medium ${weekDelta >= 0 ? "text-pine" : "text-muted"}`}>{weekDelta >= 0 ? "+" : ""}{weekDelta} versets appris par rapport à la semaine dernière</p>}
        <div className="mt-4"><BarChart label="Versets appris et révisés par semaine" data={s.weekly.map((w) => ({ label: fmtShort(w.week_start), a: w.new, b: w.reviewed, title: `Semaine du ${fmtShort(w.week_start)} : ${w.new} appris, ${w.reviewed} révisés` }))} /></div>
        <ul className="mt-3 flex gap-4 text-xs text-muted"><li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-pine" />Appris</li><li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-state-review/55" />Révisés</li></ul>
      </section>

      <section className="card mt-4 p-5" aria-labelledby="evo-title">
        <h2 id="evo-title" className="text-lg font-semibold">Évolution de la maîtrise</h2>
        <p className="text-sm text-muted">Maîtrise réelle de ton objectif sur 30 jours.</p>
        <div className="mt-4"><AreaChart label="Évolution de la maîtrise sur 30 jours" points={s.daily.map((d) => d.mastery)} max={Math.max(10, Math.ceil(Math.max(...s.daily.map((d) => d.mastery ?? 0)) / 10) * 10)} /></div>
      </section>

      <section className="card mt-4 p-5" aria-labelledby="dist-title">
        <h2 id="dist-title" className="text-lg font-semibold">Solidité des versets travaillés</h2>
        <div className="mt-4"><BarChart height={110} label="Répartition des versets par score de maîtrise" data={s.mastery_distribution.map((d) => ({ label: `${d.label} %`, a: d.count, title: `${d.label} % : ${d.count} versets` }))} /></div>
      </section>

      <section className="mt-6" aria-labelledby="ach-title">
        <h2 id="ach-title" className="mb-3 text-lg font-semibold">Étapes franchies <span className="text-sm font-normal text-muted">{achievements.filter((a) => a.unlocked).length} / {achievements.length}</span></h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {achievements.map((a) => (
            <li key={a.code} className={`card flex items-center gap-3.5 p-4 ${a.unlocked ? "" : "opacity-60"}`}>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${a.unlocked ? "bg-pine text-pine-on" : "bg-sunken text-muted"}`}><AchievementIcon name={a.icon} /></span>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{a.title}</p>
                <p className="text-sm text-muted">{a.unlocked && a.unlocked_at ? `Atteinte le ${fmtDate(a.unlocked_at.slice(0, 10), { day: "numeric", month: "long" })}` : a.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
