import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Plus, Star, Target, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DatePresets, PacePicker } from "@/components/PacePicker";
import { ScopePicker } from "@/components/ScopePicker";
import { EmptyState, ErrorState, PageHeader, PageSkeleton, Sheet, Skeleton } from "@/components/ui";
import { useGoals, useInvalidateProgress, useSurahs } from "@/hooks/queries";
import { api } from "@/services/api";
import { ApiError } from "@/services/http";
import { toast } from "@/stores/toast";
import type { Goal, GoalInput, GoalItemInput } from "@/types/api";
import { addDays, fmtDate, fmtHijri, fmtPct, toISO } from "@/utils/format";
import { emptyScope, scopeItems, scopeTitle, type Scope } from "@/utils/scope";

type FormKind = "scope" | "count" | "daily" | "weekly";
const KINDS: { value: FormKind; label: string; hint: string }[] = [
  { value: "scope", label: "Juz' ou sourates", hint: "Mémoriser les juz ou les sourates de ton choix avant une date" },
  { value: "count", label: "Versets", hint: "Un nombre de versets d'ici une date" },
  { value: "daily", label: "Quotidien", hint: "Un nombre de versets chaque jour" },
  { value: "weekly", label: "Hebdo", hint: "Un nombre de versets chaque semaine" },
];
const errorText = (e: unknown) => (e instanceof ApiError ? e.fields?.[0]?.message ?? e.message : "Une erreur est survenue.");

export default function Goals() {
  const { data, isLoading, isError, refetch } = useGoals();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.get("nouveau") === "1");
  const close = () => { setCreating(false); if (params.has("nouveau")) setParams({}, { replace: true }); };

  if (isLoading) return <PageSkeleton />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;
  return (
    <>
      <PageHeader title="Objectifs" subtitle="Une destination, une date : le plan se calcule tout seul."
        action={<button className="btn-primary !px-4" aria-label="Nouvel objectif" onClick={() => setCreating(true)}><Plus size={18} /><span className="hidden sm:inline">Nouvel objectif</span></button>} />
      {data.length === 0 ? (
        <div className="card"><EmptyState icon={Target} title="Aucun objectif pour l'instant" action={<button className="btn-primary" onClick={() => setCreating(true)}>Créer mon premier objectif</button>}>Par exemple : un juz avant une date, une sourate avant vendredi, ou 50 versets cette semaine.</EmptyState></div>
      ) : (
        <ul className="space-y-3">{data.map((g) => <li key={g.id}><GoalCard goal={g} /></li>)}</ul>
      )}
      <Sheet open={creating} onClose={close} title="Nouvel objectif"><GoalForm onDone={close} hasPrimary={data.some((g) => g.is_primary)} /></Sheet>
    </>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const invalidate = useInvalidateProgress();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [date, setDate] = useState(goal.target_date ?? "");
  const update = useMutation({
    mutationFn: (b: Parameters<typeof api.updateGoal>[1]) => api.updateGoal(goal.id, b),
    onSuccess: async () => { await invalidate(); setEditing(false); toast("Objectif mis à jour. Ton plan a été recalculé.", "success"); },
    onError: (e) => toast(errorText(e), "error"),
  });
  const remove = useMutation({ mutationFn: () => api.deleteGoal(goal.id), onSuccess: async () => { await invalidate(); toast("Objectif supprimé."); }, onError: (e) => toast(errorText(e), "error") });
  const plan = goal.plan;

  return (
    <article className={`card p-5 ${goal.is_primary ? "border-pine/40" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5">{goal.is_primary && <><Star size={12} className="fill-current text-pine" /><span className="text-pine">Objectif principal</span> · </>}{KIND_LABEL[goal.kind]}</p>
          <h2 className="mt-1 text-xl font-semibold">{goal.title}</h2>
        </div>
        <span className="shrink-0 text-2xl font-semibold tabular-nums">{fmtPct(goal.progress_pct)}<span className="text-sm text-muted"> %</span></span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={Math.round(goal.progress_pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progression de ${goal.title}`}>
        <div className="h-full rounded-full bg-pine transition-all duration-700" style={{ width: `${goal.progress_pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">{goal.summary}{goal.kind === "scope" && " · le pourcentage reflète la maîtrise réelle"}</p>

      {goal.target_date && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm"><CalendarClock size={15} className="text-muted" /><span className="font-medium">{fmtDate(goal.target_date)}</span><span className="text-muted">≈ {fmtHijri(goal.target_date)} · J-{goal.days_left}</span></p>
      )}
      {plan && plan.status !== "completed" && (
        <div className="mt-3 rounded-xl bg-sunken/70 p-3 text-sm">
          <p className="font-semibold">{plan.headline}</p>
          <p className="mt-0.5 text-muted">{goal.daily_new} versets/jour · {plan.weekly_new} par semaine · marge de {Math.max(0, plan.margin_days)} j{plan.projected_end && ` · fin estimée le ${fmtDate(plan.projected_end, { day: "numeric", month: "short" })}`}</p>
        </div>
      )}

      {editing && goal.target_date && (
        <form className="mt-4 animate-fade space-y-3 rounded-xl border border-line p-3" onSubmit={(e) => { e.preventDefault(); update.mutate({ target_date: date }); }}>
          <label className="label" htmlFor={`date-${goal.id}`}>Nouvelle date cible</label>
          <input id={`date-${goal.id}`} type="date" className="field" value={date} min={toISO(addDays(new Date(), 1))} onChange={(e) => setDate(e.target.value)} required />
          <p className="text-xs text-muted">Le rythme quotidien sera recalculé à partir d'aujourd'hui.</p>
          <div className="flex gap-2"><button className="btn-primary flex-1" disabled={update.isPending || !date}>Recalculer mon plan</button><button type="button" className="btn-quiet" onClick={() => setEditing(false)}>Annuler</button></div>
        </form>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {goal.target_date && !editing && <button className="chip" onClick={() => setEditing(true)}>Modifier la date</button>}
        {goal.kind === "scope" && !goal.is_primary && <button className="chip" onClick={() => update.mutate({ is_primary: true })}>Définir comme principal</button>}
        {confirm ? (
          <span className="flex items-center gap-2 text-sm"><span className="text-muted">Supprimer ?</span><button className="chip !border-clay !text-clay" onClick={() => remove.mutate()} disabled={remove.isPending}>Oui</button><button className="chip" onClick={() => setConfirm(false)}>Non</button></span>
        ) : (
          <button className="chip" onClick={() => setConfirm(true)} aria-label={`Supprimer ${goal.title}`}><Trash2 size={14} /></button>
        )}
      </div>
    </article>
  );
}

const KIND_LABEL: Record<Goal["kind"], string> = { scope: "Mémorisation", count: "Nombre de versets", daily: "Quotidien", weekly: "Hebdomadaire" };

function GoalForm({ onDone, hasPrimary }: { onDone: () => void; hasPrimary: boolean }) {
  const invalidate = useInvalidateProgress();
  const surahs = useSurahs();
  const [kind, setKind] = useState<FormKind>("scope");
  const [scope, setScope] = useState<Scope>(emptyScope);
  const [count, setCount] = useState(50);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [pace, setPace] = useState<number | null>(null);
  const [primary, setPrimary] = useState(!hasPrimary);

  const scoped = kind === "scope";
  const items: GoalItemInput[] = useMemo(() => (scoped ? scopeItems(scope) : []), [scoped, scope]);
  const needsDate = scoped || kind === "count";
  const validDate = !!date && date > toISO(new Date());

  const preview = useQuery({
    queryKey: ["goal-preview", items, date], queryFn: () => api.previewGoal({ target_date: date, items }),
    enabled: scoped && items.length > 0 && validDate, staleTime: 60_000,
  });
  useEffect(() => { setPace(preview.data?.options.find((o) => o.recommended)?.daily_new ?? null); }, [preview.data]);

  const auto = useMemo(() => {
    const when = needsDate && validDate ? ` avant le ${fmtDate(date, { day: "numeric", month: "long" })}` : "";
    if (scoped) return `${scopeTitle(scope, surahs.data) || "Mon objectif"}${when}`;
    if (kind === "count") return `Mémoriser ${count} versets${when}`;
    return `${count} versets ${kind === "daily" ? "par jour" : "par semaine"}`;
  }, [kind, scoped, scope, count, date, needsDate, validDate, surahs.data]);

  const create = useMutation({
    mutationFn: (b: GoalInput) => api.createGoal(b),
    onSuccess: async () => { await invalidate(); toast("Objectif créé.", "success"); onDone(); },
    onError: (e) => toast(errorText(e), "error"),
  });
  const submit = () => create.mutate({
    title: title.trim() || auto, kind, target_date: needsDate ? date : null, target_count: scoped ? null : count,
    daily_new: scoped ? pace : null, is_primary: scoped && primary, learning_order: scope.order, items,
  });
  const canSubmit = (!needsDate || validDate) && (!scoped || (items.length > 0 && pace !== null)) && (scoped || count > 0);

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (canSubmit) submit(); }}>
      <div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type d'objectif">
          {KINDS.map((k) => <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} className={`chip ${kind === k.value ? "chip-on" : ""}`} onClick={() => setKind(k.value)}>{k.label}</button>)}
        </div>
        <p className="mt-2 text-sm text-muted">{KINDS.find((k) => k.value === kind)!.hint}</p>
      </div>

      {scoped && <ScopePicker value={scope} onChange={setScope} />}
      {!scoped && (
        <div>
          <label className="label" htmlFor="count">Combien de versets{kind === "daily" ? " par jour" : kind === "weekly" ? " par semaine" : ""} ?</label>
          <input id="count" type="number" inputMode="numeric" min={1} max={6236} className="field" value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </div>
      )}
      {needsDate && (
        <div>
          <label className="label" htmlFor="date">Pour quelle date ?</label>
          <input id="date" type="date" className="field" value={date} min={toISO(addDays(new Date(), 1))} onChange={(e) => setDate(e.target.value)} required />
          <div className="mt-2"><DatePresets value={date} onChange={setDate} /></div>
          {validDate && <p className="mt-2 text-sm text-muted">≈ {fmtHijri(date)}</p>}
        </div>
      )}

      {scoped && validDate && items.length > 0 && (
        <div>
          <span className="label">Ton rythme{preview.data ? ` : ${preview.data.remaining} versets en ${preview.data.days_left} jours` : ""}</span>
          {preview.isLoading ? <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            : preview.isError ? <p className="text-sm text-clay">{errorText(preview.error)}</p>
            : preview.data && <PacePicker options={preview.data.options} value={pace} onChange={setPace} />}
        </div>
      )}

      <div>
        <label className="label" htmlFor="title">Nom de l'objectif</label>
        <input id="title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={auto} maxLength={140} />
      </div>
      {scoped && hasPrimary && (
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--pine))]" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />En faire mon objectif principal (celui qui guide mes sessions)</label>
      )}
      <button className="btn-primary min-h-[52px] w-full" disabled={!canSubmit || create.isPending}>{create.isPending ? "Création…" : "Créer l'objectif"}</button>
    </form>
  );
}
