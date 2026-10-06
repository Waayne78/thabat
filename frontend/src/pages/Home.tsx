import { ArrowRight, BookOpen, CalendarClock, Check, Clock, RotateCw, Settings, Target } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { StackedBar } from "@/components/charts";
import { ProgressRing } from "@/components/ProgressRing";
import { EmptyState, ErrorState, PageSkeleton, StatTile } from "@/components/ui";
import { useCalendar, useOverview, useToday } from "@/hooks/queries";
import type { Plan, Today } from "@/types/api";
import { addDays, fmtDate, fmtHijri, fmtPct, fmtShort, greeting, parseDate, plural, toISO } from "@/utils/format";
import { DAY_STATUS } from "@/utils/mastery";

const TONE: Record<Plan["status"], string> = {
  ahead: "text-pine", on_track: "text-ink", completed: "text-pine", behind: "text-clay",
};

export default function Home() {
  const { data, isLoading, isError, refetch } = useToday();
  if (isLoading) return <PageSkeleton />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;
  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{fmtDate(data.date, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-0.5 text-[30px] font-bold leading-tight">{greeting()} {data.display_name}</h1>
        </div>
        <div className="flex gap-1 lg:hidden">
          <Link to="/objectifs" className="btn-quiet !px-2.5" aria-label="Objectifs"><Target size={21} strokeWidth={1.75} /></Link>
          <Link to="/reglages" className="btn-quiet !px-2.5" aria-label="Réglages"><Settings size={21} strokeWidth={1.75} /></Link>
        </div>
      </header>
      {data.goal && data.plan ? <WithGoal data={data} plan={data.plan} /> : <NoGoal />}
    </div>
  );
}

function NoGoal() {
  return (
    <div className="card">
      <EmptyState icon={Target} title="Choisis ta destination"
        action={<Link to="/objectifs?nouveau=1" className="btn-primary">Créer un objectif</Link>}>
        Un objectif et une date suffisent : Thabāt calcule ton rythme quotidien et organise tes révisions.
      </EmptyState>
    </div>
  );
}

function WithGoal({ data, plan }: { data: Today; plan: Plan }) {
  const navigate = useNavigate();
  const goal = data.goal!;
  const total = data.total ?? plan.total;
  const learnedPct = total ? ((data.learned ?? 0) / total) * 100 : 0;
  const newLeft = data.new_ayahs.length;
  const reviewsLeft = data.reviews.length;
  const nothingLeft = newLeft + reviewsLeft === 0;
  const started = data.new_done + data.review_done > 0;

  return (
    <>
      {/* 1 — where am I */}
      <section className="card overflow-hidden p-5 sm:p-6" aria-labelledby="goal-title">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Objectif actuel</p>
            <h2 id="goal-title" className="mt-1 text-xl font-semibold leading-snug">{goal.title}</h2>
          </div>
          <Link to="/objectifs" className="chip shrink-0"><CalendarClock size={14} />J-{plan.days_left}</Link>
        </div>

        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
          <ProgressRing value={data.progress_pct} secondary={learnedPct} size={176} stroke={10} label="Maîtrise réelle de l'objectif">
            <div>
              <div className="text-[48px] font-bold leading-none tracking-tight">{fmtPct(data.progress_pct)}<span className="text-2xl text-muted"> %</span></div>
              <div className="mt-1 text-xs font-medium text-muted">maîtrise réelle</div>
            </div>
          </ProgressRing>
          <div className="w-full flex-1 space-y-4">
            <p className={`text-lg font-semibold leading-snug ${TONE[plan.status]}`}>{plan.headline}</p>
            <p className="text-sm leading-relaxed text-muted">{plan.message}</p>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[["Appris", data.learned ?? 0], ["Maîtrisés", data.mastered ?? 0], ["Restants", plan.remaining]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-sunken/70 px-2 py-2.5">
                  <dd className="text-xl font-semibold tabular-nums">{v}</dd>
                  <dt className="text-[11px] text-muted">{k}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* 2 — what do I do today, and how long */}
      <section className="card p-5 sm:p-6" aria-labelledby="today-title">
        <div className="flex items-center justify-between">
          <h2 id="today-title" className="text-xl font-semibold">Aujourd'hui</h2>
          {started && <span className="text-xs font-medium text-muted">{data.new_done} appris · {data.review_done} révisés</span>}
        </div>
        {nothingLeft ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-pine-soft p-4 text-pine">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pine text-pine-on"><Check size={18} /></span>
            <div>
              <p className="font-semibold">{started ? "Journée accomplie" : "Rien de prévu pour l'instant"}</p>
              <p className="mt-0.5 text-sm opacity-90">{started ? "Ce que tu as récité aujourd'hui reviendra au bon moment. Tu peux t'arrêter là, ou prendre un peu d'avance." : "Aucune révision en attente. Tu peux avancer à ton rythme."}</p>
            </div>
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            <Row icon={BookOpen} strong={plural(newLeft, "nouveau verset", "nouveaux versets")}
              detail={newLeft ? `${data.new_ayahs[0]!.surah_name} ${data.new_ayahs[0]!.number}${newLeft > 1 ? ` → ${data.new_ayahs[newLeft - 1]!.surah_name} ${data.new_ayahs[newLeft - 1]!.number}` : ""}` : "Déjà appris pour aujourd'hui"} />
            <Row icon={RotateCw} strong={`${plural(reviewsLeft, "verset")} à réviser`}
              detail={reviewsLeft ? "Les plus fragiles d'abord" : "Ta mémoire est à jour"} />
            <Row icon={Clock} strong={`Environ ${data.estimated_minutes} min`} detail={`Semaine : ${plan.weekly_new} versets · marge de ${plural(Math.max(0, plan.margin_days), "jour")}`} />
          </ul>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {nothingLeft ? (
            <button className="btn-ghost flex-1" onClick={() => navigate("/session?extra=3")}>Prendre de l'avance (3 versets)</button>
          ) : (
            <button className="btn-primary min-h-[52px] flex-1 text-base" onClick={() => navigate("/session")}>
              {started ? "Reprendre ma session" : "Commencer ma session"}<ArrowRight size={18} />
            </button>
          )}
          {reviewsLeft > 0 && newLeft > 0 && <button className="btn-ghost" onClick={() => navigate("/session?mode=review")}>Réviser seulement</button>}
        </div>
      </section>

      {/* 3 — rhythm */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-1 sm:grid-cols-4">
        <StatTile label="Série" value={data.streak.current} hint={data.streak.active_today ? "jours · validée aujourd'hui" : data.streak.current ? "jours · à prolonger aujourd'hui" : "commence aujourd'hui"} />
        <StatTile label="Meilleure série" value={data.streak.best} hint="jours consécutifs" />
        <StatTile label="Échéance" value={`J-${plan.days_left}`} hint={fmtHijri(goal.target_date) || fmtDate(goal.target_date)} />
        <StatTile label="Fin estimée" value={plan.projected_end ? fmtShort(plan.projected_end) : "—"} hint={plan.projected_end && plan.projected_end > goal.target_date ? "au rythme actuel — on peut ajuster" : "au rythme actuel"} />
      </div>

      <Trajectory data={data} plan={plan} />
      <WeekStrip today={data.date} />
      <RecentlyMastered />
    </>
  );
}

function Row({ icon: Icon, strong, detail }: { icon: typeof BookOpen; strong: string; detail: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <Icon size={20} strokeWidth={1.75} className="w-6 shrink-0 text-muted" />
      <div className="min-w-0">
        <p className="font-semibold leading-tight">{strong}</p>
        <p className="truncate text-sm text-muted">{detail}</p>
      </div>
    </li>
  );
}

function Trajectory({ data, plan }: { data: Today; plan: Plan }) {
  const c = data.counts;
  if (!c) return null;
  const expectedPct = plan.total ? Math.min(100, (plan.expected_learned / plan.total) * 100) : 0;
  return (
    <section className="card p-5" aria-labelledby="traj-title">
      <div className="flex items-baseline justify-between">
        <h2 id="traj-title" className="text-lg font-semibold">Progression vers l'objectif</h2>
        <Link to="/ancrage" className="text-sm font-medium text-pine">Voir la carte</Link>
      </div>
      <div className="relative mt-5">
        <StackedBar label="Répartition des versets par niveau" parts={[
          { value: c.mastered, className: "bg-m-4", label: "Maîtrisés" },
          { value: c.learned, className: "bg-m-3", label: "Appris" },
          { value: c.to_review, className: "bg-m-2", label: "À réviser" },
          { value: c.in_progress, className: "bg-m-1", label: "En cours" },
          { value: c.to_learn, className: "bg-transparent", label: "À apprendre" },
        ]} />
        <div className="absolute -top-2 h-7 w-0.5 rounded-full bg-ink/70" style={{ left: `${expectedPct}%` }} title="Où le plan t'attend aujourd'hui" />
      </div>
      <p className="mt-2 text-xs text-muted">Le trait marque l'endroit où ton plan t'attend aujourd'hui ({plan.expected_learned} versets).</p>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        {[["bg-m-4", "Maîtrisés", c.mastered], ["bg-m-3", "Appris", c.learned], ["bg-m-2", "À réviser", c.to_review], ["bg-m-1", "En cours", c.in_progress], ["bg-m-0", "À apprendre", c.to_learn]].map(([cls, label, n]) => (
          <li key={label} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${cls}`} />{label} <span className="font-semibold text-ink tabular-nums">{n}</span></li>
        ))}
      </ul>
    </section>
  );
}

function WeekStrip({ today }: { today: string }) {
  const t = parseDate(today);
  const monday = addDays(t, -((t.getDay() + 6) % 7));
  const { data } = useCalendar(toISO(monday), toISO(addDays(monday, 6)));
  return (
    <section className="card p-5" aria-labelledby="week-title">
      <div className="flex items-baseline justify-between">
        <h2 id="week-title" className="text-lg font-semibold">Cette semaine</h2>
        <Link to="/calendrier" className="text-sm font-medium text-pine">Calendrier</Link>
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1.5">
        {(data?.days ?? Array.from({ length: 7 }, () => null)).map((d, i) => {
          const date = addDays(monday, i);
          const isToday = toISO(date) === today;
          const s = d ? DAY_STATUS[d.status] : null;
          return (
            <li key={i} className="flex flex-col items-center gap-2" title={d ? `${s!.label} — ${d.new} appris, ${d.reviewed} révisés` : undefined}>
              <span className={`text-[11px] font-medium uppercase ${isToday ? "text-pine" : "text-muted"}`}>{new Intl.DateTimeFormat("fr-FR", { weekday: "narrow" }).format(date)}</span>
              <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold tabular-nums ${isToday ? "ring-2 ring-pine ring-offset-2 ring-offset-surface" : ""} ${
                d && ["done", "partial", "review", "missed"].includes(d.status) ? `${s!.dot} text-white` : "bg-sunken text-muted"}`}>
                {date.getDate()}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RecentlyMastered() {
  const { data } = useOverview();
  const items = data?.recently_mastered ?? [];
  return (
    <section className="card p-5" aria-labelledby="recent-title">
      <h2 id="recent-title" className="text-lg font-semibold">Récemment maîtrisés</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">Un verset devient « maîtrisé » après plusieurs récitations réussies, espacées dans le temps. Les premiers apparaîtront ici — c'est le signe que l'ancrage tient.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line/70">
          {items.map((m) => (
            <li key={m.ayah_id} className="flex items-center justify-between py-2.5">
              <span className="font-medium">{m.surah_name} <span className="text-muted">· verset {m.number}</span></span>
              <span className="rounded-full bg-pine-soft px-2.5 py-0.5 text-sm font-semibold text-pine tabular-nums">{Math.round(m.mastery)} %</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
