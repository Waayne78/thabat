import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Grid3x3, Play } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AyahText } from "@/components/AyahText";
import { KnownPicker } from "@/components/KnownPicker";
import { EmptyState, ErrorState, PageHeader, PageSkeleton, Segmented, Sheet, Skeleton } from "@/components/ui";
import { useInvalidateProgress, useOverview, useToday } from "@/hooks/queries";
import { toast } from "@/stores/toast";
import { plural } from "@/utils/format";
import { juzName } from "@/utils/scope";
import { api } from "@/services/api";
import type { MapCell, MapSurah } from "@/types/api";
import { fmtPct, relativeDue } from "@/utils/format";
import { masteryStep, STATUS_LABEL, STEP_BG, STEP_LABEL } from "@/utils/mastery";

type Filter = "all" | "weak" | "todo";

export default function Mastery() {
  const { data, isLoading, isError, refetch } = useOverview();
  const today = useToday().data?.date ?? new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<number | null>(null);
  const [cell, setCell] = useState<{ cell: MapCell; surah: MapSurah } | null>(null);
  const [declaring, setDeclaring] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;
  if (!data.goal) {
    return (<><PageHeader title="Ancrage" /><div className="card"><EmptyState icon={Grid3x3} title="Ta carte est encore vierge" action={<Link className="btn-primary" to="/objectifs?nouveau=1">Créer un objectif</Link>}>Dès que tu auras un objectif, chaque verset aura sa case ici, colorée selon sa maîtrise réelle.</EmptyState></div></>);
  }

  const surahs = data.surahs.filter((s) => filter === "all" || (filter === "weak" ? s.cells.some((c) => c.status === "to_review" || c.status === "in_progress") : s.learned < s.ayah_count));
  const juzGroups = [...new Set(surahs.map((s) => s.juz))];

  return (
    <>
      <PageHeader title="Ancrage" subtitle="Chaque case est un verset. Sa couleur dit à quel point il tient en mémoire." />
      <div className="card mb-4 p-4">
        <div className="flex items-end justify-between">
          <div><p className="eyebrow">Maîtrise réelle</p><p className="text-4xl font-semibold tabular-nums">{fmtPct(data.progress_pct)} <span className="text-xl text-muted">%</span></p></div>
          <ul className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] text-muted" aria-label="Légende">
            {STEP_LABEL.map((l, i) => <li key={l} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${STEP_BG[i]}`} />{l}</li>)}
          </ul>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><Segmented label="Filtrer" value={filter} onChange={setFilter} options={[{ value: "all", label: "Tout" }, { value: "weak", label: "À consolider" }, { value: "todo", label: "Non terminées" }]} /><button className="chip" onClick={() => setDeclaring(true)}>Je connais déjà…</button></div>

      {surahs.length === 0 && <div className="card"><EmptyState icon={Grid3x3} title="Rien ici pour l'instant">Aucune sourate ne correspond à ce filtre.</EmptyState></div>}

      {juzGroups.map((juz) => (
        <section key={juz ?? 0} className="mb-6">
          <h2 className="eyebrow mb-2 px-1">{juz ? juzName(juz) : "Autres"}</h2>
          <ul className="space-y-2">
            {surahs.filter((s) => s.juz === juz).map((s) => (
              <li key={s.id} className="card overflow-hidden">
                <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold tabular-nums text-muted">{s.id}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{s.name}</span>
                      <span className="shrink-0 text-sm tabular-nums text-muted">{s.learned}/{s.ayah_count} · <span className="font-semibold text-ink">{Math.round(s.mastery)} %</span></span>
                    </div>
                    <MiniStrip cells={s.cells} />
                  </div>
                  <ChevronDown size={18} className={`shrink-0 text-muted transition ${open === s.id ? "rotate-180" : ""}`} />
                </button>
                {open === s.id && (
                  <div className="animate-fade border-t border-line/70 p-4">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5">
                      {s.cells.map((c) => {
                        const step = masteryStep(c.mastery, c.status !== "to_learn");
                        return (
                          <button key={c.ayah_id} onClick={() => setCell({ cell: c, surah: s })} aria-label={`Verset ${c.number}, ${STATUS_LABEL[c.status]}, maîtrise ${Math.round(c.mastery)} %`}
                            className={`relative grid aspect-square place-items-center rounded-lg text-xs font-semibold tabular-nums transition hover:scale-105 ${STEP_BG[step]} ${step === 4 ? "text-pine-on" : step === 0 ? "text-muted" : "text-ink"}`}>
                            {c.number}
                            {c.status === "to_review" && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-clay" />}
                          </button>
                        );
                      })}
                    </div>
                    <Link to={`/session?sourate=${s.id}`} className="btn-ghost mt-4 w-full"><Play size={16} />Travailler cette sourate</Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Sheet open={declaring} onClose={() => setDeclaring(false)} title="Versets déjà connus">
        {declaring && <DeclareKnown surahs={data.surahs} onDone={() => setDeclaring(false)} />}
      </Sheet>

      <Sheet open={!!cell} onClose={() => setCell(null)} title={cell ? `${cell.surah.name} · verset ${cell.cell.number}` : ""}>
        {cell && <CellDetail cell={cell.cell} surahId={cell.surah.id} today={today} />}
      </Sheet>
    </>
  );
}

function MiniStrip({ cells }: { cells: MapCell[] }) {
  return (
    <div className="mt-2 flex h-1.5 gap-px overflow-hidden rounded-full" aria-hidden="true">
      {cells.map((c) => <span key={c.ayah_id} className={`flex-1 ${STEP_BG[masteryStep(c.mastery, c.status !== "to_learn")]}`} />)}
    </div>
  );
}

function CellDetail({ cell, surahId, today }: { cell: MapCell; surahId: number; today: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["ayah", cell.ayah_id], queryFn: () => api.ayah(cell.ayah_id), staleTime: Infinity });
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[[`${Math.round(cell.mastery)} %`, "Maîtrise"], [STATUS_LABEL[cell.status], "Niveau"], [cell.status === "to_learn" ? "—" : relativeDue(cell.due_date, today), "Prochaine révision"]].map(([v, k]) => (
          <div key={k} className="rounded-xl bg-sunken/70 px-2 py-3"><div className="text-[15px] font-semibold">{v}</div><div className="text-[11px] text-muted">{k}</div></div>
        ))}
      </div>
      <div className="card mt-4 p-5">
        {isLoading || !data ? <Skeleton className="h-24 w-full" /> : (<><AyahText text={data.text_ar} scale={85} />{data.translation && <p className="mt-3 text-center text-sm leading-relaxed text-muted">{data.translation}</p>}</>)}
      </div>
      <button className="btn-primary mt-4 w-full" onClick={() => navigate(`/session?sourate=${surahId}`)}><Play size={16} fill="currentColor" />Travailler cette sourate</button>
    </div>
  );
}

function DeclareKnown({ surahs, onDone }: { surahs: MapSurah[]; onDone: () => void }) {
  const invalidate = useInvalidateProgress();
  const [value, setValue] = useState<Set<number>>(new Set());
  const [level, setLevel] = useState<"solid" | "approximate">("solid");
  const [busy, setBusy] = useState(false);
  const locked = new Set(surahs.flatMap((s) => s.cells.filter((c) => c.status !== "to_learn").map((c) => c.ayah_id)));
  const list = surahs.map((s) => ({ id: s.id, name: s.name, firstAyahId: s.cells[0] ? s.cells[0].ayah_id - s.cells[0].number + 1 : 0, ayahIds: s.cells.map((c) => c.ayah_id) }));
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.markKnown([...value], level);
      await invalidate();
      toast(`${plural(r.marked, "verset ajouté", "versets ajoutés")} à tes acquis. Ils reviendront en révision.`, "success");
      onDone();
    } catch {
      toast("Enregistrement impossible. Réessaie.", "error");
      setBusy(false);
    }
  };
  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-muted">Coche ce que tu sais déjà réciter. Ces versets ne seront plus proposés comme nouveaux ; ils passeront en révision pour confirmer leur niveau.</p>
      <KnownPicker surahs={list} value={value} onChange={setValue} locked={locked} />
      <div className="mt-4"><span className="label">À quel point les connais-tu ?</span><Segmented label="Niveau de connaissance" value={level} onChange={setLevel} options={[{ value: "solid", label: "Je les récite sans aide" }, { value: "approximate", label: "À peu près" }]} /></div>
      <button className="btn-primary mt-5 w-full" disabled={busy || value.size === 0} onClick={() => void save()}>{value.size ? `Ajouter ${plural(value.size, "verset")}` : "Sélectionne des versets"}</button>
    </div>
  );
}
