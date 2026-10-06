import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Eye, EyeOff, Flame, Lightbulb, Pause, Repeat, RotateCw, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { AchievementIcon } from "@/components/AchievementIcon";
import { AyahText } from "@/components/AyahText";
import { ProgressRing } from "@/components/ProgressRing";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useInvalidateProgress } from "@/hooks/queries";
import { useAudio } from "@/hooks/useAudio";
import { api } from "@/services/api";
import { ApiError } from "@/services/http";
import { useAuth } from "@/stores/auth";
import { toast } from "@/stores/toast";
import type { AchievementDef, Ayah, Rating, RecordResult, SessionSummary } from "@/types/api";
import { hiddenIndexes, splitWords } from "@/utils/arabic";
import { fmtClock, fmtDuration, plural } from "@/utils/format";
import { RATINGS, STATUS_LABEL, suggestRating } from "@/utils/mastery";

type Stage = "read" | "repeat" | "test" | "recite";
interface Item { kind: "new" | "review"; ayah: Ayah; mastery: number }

const STAGES: { value: Stage; label: string }[] = [
  { value: "read", label: "Lecture" }, { value: "repeat", label: "Répétition" }, { value: "test", label: "Test" }, { value: "recite", label: "Récitation" },
];

async function loadQueue(mode: string, extra: number, surahId: number | null): Promise<Item[]> {
  if (surahId) {
    const [surah, overview] = await Promise.all([api.surah(surahId), api.overview()]);
    const cells = new Map(overview.surahs.flatMap((s) => s.cells).map((c) => [c.ayah_id, c]));
    return surah.ayahs.map((ayah) => {
      const cell = cells.get(ayah.id);
      return { kind: !cell || cell.status === "to_learn" ? "new" : "review", ayah, mastery: cell?.mastery ?? 0 } as Item;
    });
  }
  const today = await api.today(extra);
  const reviews: Item[] = today.reviews.map((r) => ({ kind: r.status === "in_progress" ? "new" : "review", ayah: r.ayah, mastery: r.mastery }));
  if (mode === "review") return reviews;
  // fresh mind first: new verses, then the consolidation pass
  return [...today.new_ayahs.map((ayah) => ({ kind: "new" as const, ayah, mastery: 0 })), ...reviews];
}

export default function Session() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const invalidate = useInvalidateProgress();
  const mode = params.get("mode") === "review" ? "review" : params.get("sourate") ? "free" : "daily";
  const extra = Number(params.get("extra") ?? 0) || 0;
  const surahId = Number(params.get("sourate")) || null;

  const queueQuery = useQuery({ queryKey: ["session-queue", mode, extra, surahId], queryFn: () => loadQueue(mode, extra, surahId), staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false });
  const queue = queueQuery.data;

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<RecordResult[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(Date.now());
  const finishing = useRef(false);

  useEffect(() => {
    if (!queue?.length || sessionId !== null) return;
    startedAt.current = Date.now();
    api.startSession(mode).then((s) => setSessionId(s.id)).catch(() => null);
  }, [queue, sessionId, mode]);

  useEffect(() => {
    if (summary) return;
    const id = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [summary]);

  const finish = useCallback(async (leave: boolean) => {
    if (finishing.current) return;
    finishing.current = true;
    const duration = Math.round((Date.now() - startedAt.current) / 1000);
    let done: SessionSummary | null = null;
    if (sessionId !== null) done = await api.finishSession(sessionId, duration).catch(() => null);
    await invalidate();
    if (leave || !done) navigate("/");
    else setSummary(done);
  }, [sessionId, invalidate, navigate]);

  const onRated = useCallback((r: RecordResult) => {
    setResults((prev) => [...prev, r]);
    r.unlocked.forEach((a) => toast(`Nouvelle étape : ${a.title}`, "success"));
    if (queue && index + 1 >= queue.length) void finish(false);
    else setIndex((i) => i + 1);
  }, [queue, index, finish]);

  if (queueQuery.isLoading) return <Shell onClose={() => navigate("/")}><div className="space-y-4 pt-10"><Skeleton className="mx-auto h-6 w-40" /><Skeleton className="h-48 w-full" /><Skeleton className="h-14 w-full" /></div></Shell>;
  if (queueQuery.isError || !queue) return <Shell onClose={() => navigate("/")}><div className="pt-10"><ErrorState onRetry={() => void queueQuery.refetch()} /></div></Shell>;
  if (summary) return <Summary summary={summary} results={results} onHome={() => navigate("/")} onMore={() => { window.location.assign("/session?extra=3"); }} />;
  if (queue.length === 0) {
    return (
      <Shell onClose={() => navigate("/")}>
        <div className="pt-10">
          <EmptyState icon={Check} title="Tout est à jour"
            action={<div className="flex flex-col gap-2"><button className="btn-primary" onClick={() => navigate("/session?extra=3", { replace: true })}>Apprendre 3 versets de plus</button><button className="btn-quiet" onClick={() => navigate("/")}>Retour</button></div>}>
            Rien à apprendre ni à réviser pour le moment. Ta mémoire travaille pour toi : reviens demain, ou prends un peu d'avance.
          </EmptyState>
        </div>
      </Shell>
    );
  }

  const item = queue[index]!;
  return (
    <Shell onClose={() => void finish(true)} progress={{ index, total: queue.length, seconds }}>
      <Player key={`${item.ayah.id}-${index}`} item={item} sessionId={sessionId} onRated={onRated} position={`${index + 1} / ${queue.length}`} />
    </Shell>
  );
}

function Shell({ children, onClose, progress }: { children: React.ReactNode; onClose: () => void; progress?: { index: number; total: number; seconds: number } }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-6 pt-3 sm:px-6">
      <div className="flex items-center gap-3">
        <button className="btn-quiet !px-2.5" onClick={onClose} aria-label="Terminer la session"><X size={22} /></button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label="Avancement de la session" aria-valuemin={0} aria-valuemax={progress?.total ?? 1} aria-valuenow={progress?.index ?? 0}>
          <div className="h-full rounded-full bg-pine transition-all duration-500" style={{ width: `${progress ? (progress.index / progress.total) * 100 : 0}%` }} />
        </div>
        <span className="w-12 text-right text-sm tabular-nums text-muted" aria-label="Temps écoulé">{progress ? fmtClock(progress.seconds) : ""}</span>
      </div>
      {children}
    </div>
  );
}

function Player({ item, sessionId, onRated, position }: { item: Item; sessionId: number | null; onRated: (r: RecordResult) => void; position: string }) {
  const settings = useAuth((s) => s.user?.settings);
  const { ayah } = item;
  const words = useMemo(() => splitWords(ayah.text_ar), [ayah.text_ar]);
  const [stage, setStage] = useState<Stage>(item.kind === "new" ? "read" : "recite");
  const audio = useAudio(ayah.audio_url);
  const scale = settings?.arabic_font_scale ?? 100;

  // --- repetition
  const [repTarget, setRepTarget] = useState(5);
  const [reps, setReps] = useState(0);
  const [blurred, setBlurred] = useState(false);
  // --- progressive test
  const [level, setLevel] = useState(1);
  const [peeked, setPeeked] = useState<Set<number>>(new Set());
  // --- recitation
  const [shownCount, setShownCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hints, setHints] = useState(0);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<Rating | null>(null);
  const [feedback, setFeedback] = useState<RecordResult | null>(null);

  const testHidden = useMemo(() => {
    const h = hiddenIndexes(words.length, level / 4, ayah.id);
    peeked.forEach((i) => h.delete(i));
    return h;
  }, [words.length, level, ayah.id, peeked]);
  const reciteHidden = useMemo(() => (revealed ? new Set<number>() : new Set(words.map((_, i) => i).filter((i) => i >= shownCount))), [revealed, words, shownCount]);

  const go = (s: Stage) => { audio.stop(); setStage(s); };
  const reveal = useCallback(() => setRevealed(true), []);
  const nextWord = () => {
    setHints((h) => h + 1);
    setShownCount((c) => { if (c + 1 >= words.length) setRevealed(true); return c + 1; });
  };

  const rate = useCallback(async (rating: Rating) => {
    if (saving || feedback) return;
    setSaving(rating);
    try {
      const result = await api.record(item.kind, { ayah_id: ayah.id, rating, mistakes: marked.size, session_id: sessionId });
      setFeedback(result);
      setTimeout(() => onRated(result), 1100);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Enregistrement impossible. Réessaie.", "error");
      setSaving(null);
    }
  }, [saving, feedback, item.kind, ayah.id, marked.size, sessionId, onRated]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stage !== "recite" || (e.target as HTMLElement).closest("input,textarea")) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); }
      const r = RATINGS.find((x) => x.key === e.key);
      if (revealed && r) void rate(r.value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, revealed, reveal, rate]);

  const suggested = suggestRating(marked.size, hints, words.length);
  const Translation = () => (
    <div className="mx-auto mt-5 max-w-md space-y-2 text-center">
      {settings?.show_transliteration && ayah.transliteration && <p className="text-sm italic text-muted">{ayah.transliteration}</p>}
      {settings?.show_translation !== false && ayah.translation && <p className="text-[15px] leading-relaxed text-muted">{ayah.translation}</p>}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="eyebrow">{item.kind === "new" ? "Nouveau verset" : "Révision"} · {position}</p>
          <h1 className="mt-0.5 text-xl font-semibold">{ayah.surah_name} <span className="text-muted">· verset {ayah.number}</span></h1>
        </div>
        <button onClick={() => audio.toggle(1)} className="btn-ghost !min-h-11 !px-3.5" aria-label={audio.playing ? "Mettre en pause" : "Écouter la récitation"}>
          {audio.playing ? <Pause size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <div role="tablist" aria-label="Mode" className="mt-4 grid grid-cols-4 rounded-xl bg-sunken p-1">
        {STAGES.map((s) => (
          <button key={s.value} role="tab" aria-selected={stage === s.value} onClick={() => go(s.value)}
            className={`min-h-9 rounded-lg text-[13px] font-semibold transition ${stage === s.value ? "bg-surface text-ink shadow-card" : "text-muted"}`}>
            {s.value === "recite" && item.kind === "review" ? "Révision" : s.label}
          </button>
        ))}
      </div>

      <div className="card mt-4 flex flex-1 flex-col justify-center px-4 py-8 sm:px-8" key={stage}>
        <div className="animate-fade">
          {stage === "read" && (<><AyahText text={ayah.text_ar} scale={scale} /><Translation /></>)}

          {stage === "repeat" && (
            <>
              <AyahText text={ayah.text_ar} scale={scale} blurred={blurred} />
              <div className="mt-6 flex flex-col items-center gap-4">
                <button onClick={() => setReps((r) => r + 1)} className="rounded-full transition active:scale-95" aria-label={`J'ai récité une fois. ${reps} sur ${repTarget}`}>
                  <ProgressRing value={(Math.min(reps, repTarget) / repTarget) * 100} size={132} stroke={9} label="Répétitions">
                    <div><div className="text-3xl font-semibold tabular-nums">{reps}<span className="text-base text-muted">/{repTarget}</span></div><div className="text-[11px] font-medium text-muted">touche après<br />chaque récitation</div></div>
                  </ProgressRing>
                </button>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {[3, 5, 7, 10].map((n) => <button key={n} className={`chip ${repTarget === n ? "chip-on" : ""}`} onClick={() => setRepTarget(n)} aria-pressed={repTarget === n}>×{n}</button>)}
                </div>
              </div>
            </>
          )}

          {stage === "test" && (
            <>
              <AyahText text={ayah.text_ar} scale={scale} hidden={testHidden}
                onWordClick={(i) => testHidden.has(i) && setPeeked((p) => new Set(p).add(i))}
                wordLabel={(i, h) => (h ? `Mot ${i + 1} masqué — toucher pour le voir` : `Mot ${i + 1}`)} />
              <div className="mt-6 flex items-center justify-center gap-1.5" aria-label={`Niveau de masquage ${level} sur 4`}>
                {[1, 2, 3, 4].map((n) => <button key={n} onClick={() => { setLevel(n); setPeeked(new Set()); }} aria-label={`Masquer ${n * 25} %`} className={`h-2 w-10 rounded-full transition ${n <= level ? "bg-pine" : "bg-sunken"}`} />)}
              </div>
              <p className="mt-3 text-center text-sm text-muted">{level * 25} % des mots masqués · récite, puis touche un mot pour vérifier{peeked.size > 0 && ` · ${plural(peeked.size, "mot vérifié", "mots vérifiés")}`}</p>
            </>
          )}

          {stage === "recite" && (
            <>
              {!revealed && shownCount === 0 && (
                <p className="mb-5 text-center text-sm text-muted">Récite ce verset de mémoire, à voix haute si tu peux.</p>
              )}
              <AyahText text={ayah.text_ar} scale={scale} hidden={reciteHidden} marked={marked}
                onWordClick={revealed && !feedback ? (i) => setMarked((m) => { const n = new Set(m); if (n.has(i)) n.delete(i); else n.add(i); return n; }) : undefined}
                wordLabel={(i) => `Mot ${i + 1} — marquer une erreur`} />
              {revealed && <Translation />}
              {revealed && !feedback && (
                <p className="mt-5 text-center text-sm text-muted">
                  {marked.size ? `${plural(marked.size, "erreur marquée", "erreurs marquées")} · touche un mot pour l'annuler` : "Touche les mots où tu t'es trompé ou as hésité."}
                </p>
              )}
              {feedback && <Feedback result={feedback} />}
            </>
          )}
        </div>
      </div>

      {/* action bar */}
      <div className="sticky bottom-0 -mx-4 mt-4 bg-gradient-to-t from-paper via-paper to-transparent px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-4 sm:-mx-6 sm:px-6">
        {stage === "read" && (
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button className="btn-primary min-h-[52px] flex-1" onClick={() => go("repeat")}>Passer à la répétition<ArrowRight size={18} /></button>
            <button className="btn-ghost min-h-[52px]" onClick={() => go("recite")}>Je connais ce verset</button>
          </div>
        )}
        {stage === "repeat" && (
          <div className="flex gap-2">
            <button className="btn-ghost min-h-[52px] !px-4" onClick={() => audio.toggle(repTarget)} aria-label={`Écouter ${repTarget} fois`}>
              {audio.playing ? <Pause size={18} /> : <Repeat size={18} />}<span className="hidden sm:inline">Écouter ×{repTarget}</span>
            </button>
            <button className="btn-ghost min-h-[52px] !px-4" onClick={() => setBlurred((b) => !b)} aria-pressed={blurred} aria-label={blurred ? "Afficher le texte" : "Estomper le texte"}>
              {blurred ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button className={`${reps >= repTarget ? "btn-primary" : "btn-ghost"} min-h-[52px] flex-1`} onClick={() => go("test")}>Passer au test<ArrowRight size={18} /></button>
          </div>
        )}
        {stage === "test" && (
          <div className="flex gap-2">
            <button className="btn-ghost min-h-[52px] !px-4" onClick={() => { setLevel(1); setPeeked(new Set()); go("read"); }} aria-label="Revoir le verset"><Eye size={18} /></button>
            {level < 4
              ? <button className="btn-primary min-h-[52px] flex-1" onClick={() => { setLevel((l) => l + 1); setPeeked(new Set()); }}>Masquer davantage</button>
              : <button className="btn-primary min-h-[52px] flex-1" onClick={() => go("recite")}>Réciter sans regarder<ArrowRight size={18} /></button>}
          </div>
        )}
        {stage === "recite" && !revealed && (
          <div className="flex gap-2">
            <button className="btn-ghost min-h-[52px]" onClick={nextWord}><Lightbulb size={18} />Mot suivant</button>
            <button className="btn-primary min-h-[52px] flex-1" onClick={reveal}>Révéler le verset</button>
          </div>
        )}
        {stage === "recite" && revealed && !feedback && (
          <fieldset disabled={saving !== null}>
            <legend className="mb-2 w-full text-center text-sm font-medium text-muted">Comment était ta récitation ?</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {RATINGS.map((r) => (
                <button key={r.value} onClick={() => void rate(r.value)} title={`${r.hint} (touche ${r.key})`}
                  className={`flex min-h-[60px] flex-col items-center justify-center rounded-2xl border px-1 text-[12px] font-semibold leading-tight transition active:scale-95 sm:text-sm ${
                    saving === r.value ? "border-pine bg-pine text-pine-on" : suggested === r.value ? "border-pine bg-pine-soft text-pine" : "border-line bg-surface text-ink hover:bg-sunken"}`}>
                  {r.label}
                  {suggested === r.value && saving === null && <span className="mt-0.5 text-[10px] font-medium opacity-80">suggéré</span>}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </div>
  );
}

function Feedback({ result }: { result: RecordResult }) {
  const up = result.mastery_after >= result.mastery_before;
  return (
    <div className="mx-auto mt-6 max-w-xs animate-pop rounded-2xl bg-sunken/80 p-4 text-center" role="status">
      <div className="flex items-center justify-center gap-2 text-2xl font-semibold tabular-nums">
        <span className="text-muted">{Math.round(result.mastery_before)} %</span><ArrowRight size={18} className="text-muted" />
        <span className={up ? "text-pine" : "text-clay"}>{Math.round(result.mastery_after)} %</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {result.newly_mastered ? "Verset maîtrisé." : STATUS_LABEL[result.status]} · reviendra {result.interval_days <= 1 ? "demain" : `dans ${result.interval_days} jours`}
      </p>
    </div>
  );
}

function Summary({ summary, results, onHome, onMore }: { summary: SessionSummary; results: RecordResult[]; onHome: () => void; onMore: () => void }) {
  const gain = results.reduce((s, r) => s + (r.mastery_after - r.mastery_before), 0);
  const mastered = results.filter((r) => r.newly_mastered).length;
  const retry = results.filter((r) => r.status === "in_progress").length;
  const unlocked: AchievementDef[] = results.flatMap((r) => r.unlocked);
  const line = retry
    ? `${plural(retry, "verset reviendra", "versets reviendront")} demain pour être consolidé${retry > 1 ? "s" : ""}.`
    : "Ces versets reviendront en révision dans les prochains jours.";
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 py-10 text-center">
      <Check size={32} className="text-pine" />
      <h1 className="mt-5 text-3xl font-semibold">Session terminée</h1>
      <p className="mt-2 text-muted">{line}</p>
      <dl className="mt-7 grid w-full grid-cols-3 gap-2">
        {[[summary.new_count, "appris"], [summary.review_count, "révisés"], [fmtDuration(summary.duration_seconds), "de pratique"]].map(([v, k]) => (
          <div key={k} className="card px-2 py-4"><dd className="text-2xl font-semibold tabular-nums">{v}</dd><dt className="text-xs text-muted">{k}</dt></div>
        ))}
      </dl>
      <div className="card mt-2 flex w-full items-center justify-between px-4 py-3.5 text-left">
        <span className="flex items-center gap-2.5 font-medium"><Flame size={19} className="text-clay" />Série de {plural(summary.streak.current, "jour")}</span>
        <span className="text-sm text-muted">{gain >= 0 ? "+" : ""}{Math.round(gain)} pts de maîtrise{mastered ? ` · ${plural(mastered, "maîtrisé")}` : ""}</span>
      </div>
      <div className="card mt-2 w-full px-4 py-3.5 text-left">
        <div className="flex items-center justify-between text-sm"><span className="font-medium">Niveau {summary.level.level} — {summary.level.name}</span>{summary.level.next_name && <span className="text-muted">vers {summary.level.next_name}</span>}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-pine transition-all duration-1000" style={{ width: `${summary.level.progress_pct}%` }} /></div>
      </div>
      {unlocked.map((a) => (
        <div key={a.code} className="mt-2 flex w-full animate-pop items-center gap-3 rounded-2xl bg-pine-soft px-4 py-3.5 text-left text-pine">
          <AchievementIcon name={a.icon} /><div><p className="font-semibold">{a.title}</p><p className="text-sm opacity-85">{a.description}</p></div>
        </div>
      ))}
      <div className="mt-8 flex w-full flex-col gap-2">
        <button className="btn-primary min-h-[52px]" onClick={onHome}>Retour à l'accueil</button>
        <button className="btn-quiet" onClick={onMore}><RotateCw size={16} />Continuer avec 3 versets de plus</button>
      </div>
    </div>
  );
}
