import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { KnownPicker } from "@/components/KnownPicker";
import { LogoMark } from "@/components/Logo";
import { DatePresets, PacePicker } from "@/components/PacePicker";
import { ScopePicker } from "@/components/ScopePicker";
import { Segmented, Skeleton, Switch } from "@/components/ui";
import { useInvalidateProgress, useJuz, useSurahs } from "@/hooks/queries";
import { api } from "@/services/api";
import { ApiError } from "@/services/http";
import { useAuth } from "@/stores/auth";
import type { Goal } from "@/types/api";
import { addDays, fmtDate, fmtHijri, plural, toISO } from "@/utils/format";
import { emptyScope, scopeIsEmpty, scopeItems, scopeSurahs, scopeTitle, type Scope } from "@/utils/scope";

const INTENTIONS = ["Me rapprocher du Coran", "Réciter dans mes prières", "Préparer Ramaḍān", "Transmettre à mes enfants", "Reprendre ce que j'ai oublié"];
const STEPS = ["Bienvenue", "Compte", "Intention", "Objectif", "Acquis", "Date", "Rythme", "Rappel", "Plan"];
const LAST = STEPS.length - 1;

export default function Onboarding() {
  const { user, accept, setUser } = useAuth();
  const navigate = useNavigate();
  const invalidate = useInvalidateProgress();
  const [step, setStep] = useState(user ? 2 : 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [intention, setIntention] = useState<string>(INTENTIONS[0]!);
  const [scope, setScope] = useState<Scope>(emptyScope);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [knownLevel, setKnownLevel] = useState<"solid" | "approximate">("solid");
  const [knownView, setKnownView] = useState<"goal" | "all">("goal");
  const [knownQuery, setKnownQuery] = useState("");
  const [date, setDate] = useState("");
  const [pace, setPace] = useState<number | null>(null);
  const [reminderOn, setReminderOn] = useState(true);
  const [reminderTime, setReminderTime] = useState("20:30");
  const [goal, setGoal] = useState<Goal | null>(null);

  const surahs = useSurahs(!!user);
  const juz = useJuz(!!user);
  const items = useMemo(() => scopeItems(scope), [scope]);
  const covered = useMemo(() => (surahs.data && juz.data ? scopeSurahs(scope, surahs.data, juz.data) : []), [scope, surahs.data, juz.data]);
  // known verses may be anywhere in the Quran, not only inside the goal
  const everySurah = useMemo(() => (surahs.data ?? []).map((x) => ({ id: x.id, name: x.name_translit, firstAyahId: x.first_ayah_id, ayahIds: Array.from({ length: x.ayah_count }, (_, i) => x.first_ayah_id + i) })), [surahs.data]);
  const knownList = useMemo(() => {
    const q = knownQuery.trim().toLowerCase();
    return (knownView === "goal" ? covered : everySurah).filter((x) => !q || x.name.toLowerCase().includes(q) || String(x.id) === q);
  }, [knownView, covered, everySurah, knownQuery]);
  const knownIds = useMemo(() => [...known].sort((a, b) => a - b), [known]);
  const knownSurahCount = useMemo(() => everySurah.filter((x) => x.ayahIds.some((i) => known.has(i))).length, [everySurah, known]);
  const title = scopeTitle(scope, surahs.data);
  const validDate = !!date && date > toISO(new Date());

  const preview = useQuery({
    queryKey: ["goal-preview", items, date, knownIds], queryFn: () => api.previewGoal({ target_date: date, items, exclude_ayah_ids: knownIds }),
    enabled: !!user && step >= 5 && validDate && items.length > 0,
  });
  useEffect(() => { setPace(preview.data?.options.find((o) => o.recommended)?.daily_new ?? null); }, [preview.data]);

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.fields?.[0]?.message ?? e.message : "Une erreur est survenue. Réessaie.");

  const register = async () => {
    setBusy(true); setError(null);
    try {
      accept(await api.register({ email, password, display_name: name.trim(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
      setStep(2);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const generate = async () => {
    setBusy(true); setError(null); setStep(LAST);
    try {
      if (knownIds.length) await api.markKnown(knownIds, knownLevel);
      const created = await api.createGoal({ title, kind: "scope", target_date: date, daily_new: pace, is_primary: true, learning_order: scope.order, items });
      if (reminderOn) await api.createReminder({ kind: "session", time: reminderTime, days: [0, 1, 2, 3, 4, 5, 6], frequency: "if_pending", enabled: true });
      if (reminderOn && "Notification" in window && Notification.permission === "default") void Notification.requestPermission();
      setGoal(created);
    } catch (e) { fail(e); setStep(LAST - 1); } finally { setBusy(false); }
  };

  const enter = async () => {
    setBusy(true);
    try {
      setUser(await api.updateSettings({ intention, onboarding_completed: true }));
      await invalidate();
      navigate("/", { replace: true });
    } catch (e) { fail(e); setBusy(false); }
  };

  const next = () => { setError(null); setStep((s) => s + 1); };
  const back = () => { setError(null); setStep((s) => Math.max(user ? 2 : 0, s - 1)); };
  const canBack = step > (user ? 2 : 0) && step < LAST;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-4">
      <div className="flex h-11 items-center gap-3">
        {canBack ? <button className="btn-quiet !px-2.5" onClick={back} aria-label="Étape précédente"><ArrowLeft size={20} /></button> : <span className="w-10" />}
        {step > 0 && <p className="flex-1 text-center text-sm tabular-nums text-muted" role="status" aria-label={`Étape ${step} sur ${LAST} : ${STEPS[step]}`}>{step} / {LAST}</p>}
        <span className="w-10" />
      </div>
      {step > 0 && <div className="mt-1 h-0.5 bg-sunken" aria-hidden="true"><div className="h-full bg-pine transition-all duration-500" style={{ width: `${(step / LAST) * 100}%` }} /></div>}

      <div key={step} className="flex flex-1 animate-rise flex-col">
        {step === 0 && (
          <Step>
            <div className="flex flex-1 flex-col justify-center">
              <LogoMark size={44} className="text-pine" />
              <h1 className="mt-6 text-[44px] font-bold leading-none tracking-tight">Thabāt</h1>
              <p className="mt-3 text-xl text-muted">Ce qui est ancré demeure.</p>
              <ul className="mt-10 space-y-4 text-[15px]">
                {[["Un plan à ta mesure", "Tu choisis quoi mémoriser et pour quand. Le rythme quotidien en découle."],
                  ["Des révisions au bon moment", "Chaque verset revient avant que tu ne l'oublies."],
                  ["Une maîtrise mesurée", "Un verset lu n'est pas un verset su : l'application fait la différence."]].map(([t, d], i) => (
                  <li key={t} className="flex gap-4 border-t border-line pt-4"><span className="tabular-nums text-muted">{i + 1}</span><span><span className="block font-semibold">{t}</span><span className="text-muted">{d}</span></span></li>
                ))}
              </ul>
            </div>
            <button className="btn-primary min-h-[52px] w-full" onClick={next}>Commencer<ArrowRight size={18} /></button>
            <p className="mt-4 text-center text-sm text-muted">Déjà un compte ? <Link to="/connexion" className="font-semibold text-pine">Se connecter</Link></p>
          </Step>
        )}

        {step === 1 && (
          <Step title="Ton compte" lead="Pour retrouver ta progression sur tous tes appareils.">
            <form id="account" className="flex-1 space-y-4" onSubmit={(e) => { e.preventDefault(); void register(); }} noValidate>
              <div><label className="label" htmlFor="name">Ton prénom</label><input id="name" className="field" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus /></div>
              <div><label className="label" htmlFor="email">Adresse e-mail</label><input id="email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><label className="label" htmlFor="password">Mot de passe</label><input id="password" type="password" autoComplete="new-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" /><p id="pw-hint" className="mt-1.5 text-xs text-muted">8 caractères minimum.</p></div>
              {error && <Alert>{error}</Alert>}
            </form>
            <button form="account" className="btn-primary min-h-[52px] w-full" disabled={busy || !name.trim() || !email.includes("@") || password.length < 8}>{busy ? "Création…" : "Continuer"}</button>
          </Step>
        )}

        {step === 2 && (
          <Step title="Pourquoi veux-tu mémoriser ?" lead="Tu pourras relire cette intention les jours où la motivation manque.">
            <div className="flex-1 space-y-2" role="radiogroup" aria-label="Ton intention">
              {INTENTIONS.map((i) => <Choice key={i} on={intention === i} onClick={() => setIntention(i)} title={i} />)}
            </div>
            <button className="btn-primary min-h-[52px] w-full" onClick={next}>Continuer</button>
          </Step>
        )}

        {step === 3 && (
          <Step title="Que veux-tu mémoriser ?" lead="Un ou plusieurs juz, une ou plusieurs sourates : c'est toi qui décides. Tu pourras ajouter d'autres objectifs ensuite.">
            <div className="flex-1 pb-6"><ScopePicker value={scope} onChange={setScope} /></div>
            <button className="btn-primary min-h-[52px] w-full" onClick={next} disabled={scopeIsEmpty(scope)}>Continuer</button>
          </Step>
        )}

        {step === 4 && (
          <Step title="Que connais-tu déjà ?" lead="Coche une sourate entière, ou ouvre-la pour choisir des versets précis. Ce que tu connais ne sera pas proposé comme nouveau, seulement en révision.">
            <div className="flex-1 pb-6">
              <Segmented label="Sourates affichées" value={knownView} onChange={setKnownView} options={[{ value: "goal", label: "Dans mon objectif" }, { value: "all", label: "Tout le Coran" }]} />
              <div className="relative my-3">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input className="field !pl-10" placeholder="Rechercher une sourate" aria-label="Rechercher une sourate connue" value={knownQuery} onChange={(e) => setKnownQuery(e.target.value)} />
              </div>
              {covered.length === 0 ? <Skeleton className="h-40" />
                : knownList.length === 0 ? <p className="py-4 text-sm text-muted">Aucune sourate ne correspond.</p>
                : <div className="max-h-[46dvh] overflow-y-auto rounded-xl"><KnownPicker surahs={knownList} value={known} onChange={setKnown} /></div>}
              {knownIds.length > 0 && (
                <div className="mt-4 animate-fade">
                  <span className="label">{plural(knownIds.length, "verset connu", "versets connus")} dans {plural(knownSurahCount, "sourate")}. À quel point ?</span>
                  <Segmented label="Niveau de connaissance" value={knownLevel} onChange={setKnownLevel} options={[{ value: "solid", label: "Je les récite sans aide" }, { value: "approximate", label: "À peu près" }]} />
                </div>
              )}
            </div>
            <button className="btn-primary min-h-[52px] w-full" onClick={next}>{knownIds.length ? "Continuer" : "Je pars de zéro"}</button>
          </Step>
        )}

        {step === 5 && (
          <Step title="Pour quelle date ?" lead="Elle reste modifiable à tout moment.">
            <div className="flex-1 space-y-4">
              <DatePresets value={date} onChange={setDate} />
              <div>
                <label className="label" htmlFor="date">Date cible</label>
                <input id="date" type="date" className="field" value={date} min={toISO(addDays(new Date(), 1))} onChange={(e) => setDate(e.target.value)} />
                {validDate && <p className="mt-1.5 text-sm text-muted">{fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ≈ {fmtHijri(date)}</p>}
              </div>
            </div>
            <button className="btn-primary min-h-[52px] w-full" onClick={next} disabled={!validDate}>Continuer</button>
          </Step>
        )}

        {step === 6 && (
          <Step title="Ton rythme" lead={preview.data ? `${plural(preview.data.remaining, "verset")} à apprendre en ${plural(preview.data.days_left, "jour")}.` : "Calcul en cours…"}>
            <div className="flex-1">
              {preview.isLoading ? <div className="space-y-2"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
                : preview.isError ? <Alert>{preview.error instanceof ApiError ? preview.error.message : "Calcul impossible."}</Alert>
                : preview.data && <PacePicker options={preview.data.options} value={pace} onChange={setPace} />}
              <p className="mt-3 text-sm text-muted">Le plan s'ajuste ensuite à ta progression réelle.</p>
            </div>
            <button className="btn-primary min-h-[52px] w-full" onClick={next} disabled={pace === null}>Continuer</button>
          </Step>
        )}

        {step === 7 && (
          <Step title="Un rappel quotidien ?" lead="Le même moment chaque jour aide à tenir dans la durée.">
            <div className="flex-1 space-y-4">
              <div className="card flex items-center justify-between p-4"><div><p className="font-semibold">Me rappeler ma session</p><p className="text-sm text-muted">Seulement s'il reste des versets à travailler</p></div><Switch label="Activer le rappel" checked={reminderOn} onChange={setReminderOn} /></div>
              {reminderOn && (
                <div className="animate-fade">
                  <label className="label" htmlFor="time">À quelle heure ?</label>
                  <input id="time" type="time" className="field text-2xl font-semibold" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                  <div className="mt-2 flex flex-wrap gap-2">{[["06:00", "Après Fajr"], ["13:30", "Pause de midi"], ["20:30", "Le soir"]].map(([t, l]) => <button key={t} type="button" className={`chip ${reminderTime === t ? "chip-on" : ""}`} onClick={() => setReminderTime(t!)}>{l}</button>)}</div>
                </div>
              )}
              {error && <Alert>{error}</Alert>}
            </div>
            <button className="btn-primary min-h-[52px] w-full" onClick={() => void generate()} disabled={busy}>Générer mon plan</button>
          </Step>
        )}

        {step === LAST && (!goal || !goal.plan ? (
          <div className="flex flex-1 flex-col justify-center" role="status">
            <LogoMark size={40} className="animate-pulse text-pine" />
            <h1 className="mt-6 text-2xl font-bold">Calcul de ton plan…</h1>
          </div>
        ) : (
          <Step title="Ton plan est prêt" lead={goal.title}>
            <div className="flex-1">
              <p className="text-[64px] font-bold leading-none tracking-tight tabular-nums">{goal.daily_new}</p>
              <p className="mt-1 text-lg">{goal.daily_new === 1 ? "nouveau verset" : "nouveaux versets"} par jour</p>
              <dl className="mt-8 divide-y divide-line border-y border-line text-[15px]">
                {[["Versets de l'objectif", String(goal.total)],
                  ["Déjà connus", String(goal.done)],
                  ["Par semaine", plural(goal.plan.weekly_new, "verset")],
                  ["Échéance", `${fmtDate(goal.target_date!)} (${plural(goal.plan.days_left, "jour")})`],
                  ["Marge de révision", plural(Math.max(0, goal.plan.margin_days), "jour")]].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 py-3"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>
              {error && <div className="mt-3"><Alert>{error}</Alert></div>}
            </div>
            <button className="btn-primary min-h-[52px] w-full" onClick={() => void enter()} disabled={busy}>Voir ma première session<ArrowRight size={18} /></button>
          </Step>
        ))}
      </div>
    </main>
  );
}

function Step({ title, lead, children }: { title?: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pt-6">
      {title && <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>}
      {lead && <p className="mb-6 mt-2 leading-relaxed text-muted">{lead}</p>}
      {children}
    </div>
  );
}

function Choice({ on, onClick, title, detail }: { on: boolean; onClick: () => void; title: string; detail?: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${on ? "border-pine bg-pine-soft" : "border-line bg-surface hover:border-muted"}`}>
      <span><span className="block font-medium">{title}</span>{detail && <span className="block text-sm text-muted">{detail}</span>}</span>
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${on ? "border-pine bg-pine text-pine-on" : "border-line"}`}>{on && <Check size={13} />}</span>
    </button>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-clay-soft px-4 py-3 text-sm font-medium text-clay" role="alert">{children}</p>;
}
