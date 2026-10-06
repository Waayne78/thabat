import { useMutation } from "@tanstack/react-query";
import { Bell, LogOut, Monitor, Moon, Plus, Sun, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { EmptyState, PageHeader, Sheet, Skeleton, Switch } from "@/components/ui";
import { useInvalidateProgress, useReminders } from "@/hooks/queries";
import { api } from "@/services/api";
import { ApiError } from "@/services/http";
import { useAuth } from "@/stores/auth";
import { useTheme } from "@/stores/theme";
import { toast } from "@/stores/toast";
import type { Reminder, ReminderFrequency, ReminderInput, ReminderKind, Settings as S, Theme } from "@/types/api";

export const REMINDER_KINDS: { value: ReminderKind; label: string }[] = [
  { value: "session", label: "Session du jour" }, { value: "review", label: "Révision" }, { value: "deadline", label: "Échéance" }, { value: "encouragement", label: "Point d'étape" },
];
const FREQUENCIES: { value: ReminderFrequency; label: string }[] = [
  { value: "daily", label: "Chaque jour choisi" }, { value: "if_pending", label: "Seulement s'il reste du travail" }, { value: "weekly", label: "Une fois par semaine" },
];
const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const RECITERS = [["ar.alafasy", "Mishary Al-Afasy"], ["ar.husary", "Mahmoud Khalil Al-Husary"], ["ar.minshawi", "Mohamed Siddiq Al-Minshawi"], ["ar.abdulbasitmurattal", "Abdul Basit (murattal)"]] as const;

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.display_name ?? "");
  const save = useMutation({ mutationFn: (b: Partial<S>) => api.updateSettings(b), onSuccess: setUser, onError: () => toast("Réglage non enregistré. Réessaie.", "error") });
  const rename = useMutation({ mutationFn: () => api.updateMe({ display_name: name.trim() }), onSuccess: (u) => { setUser(u); toast("Prénom mis à jour.", "success"); } });
  if (!user) return null;
  const s = user.settings;
  const pickTheme = (t: Theme) => { setTheme(t); save.mutate({ theme: t }); };

  return (
    <>
      <PageHeader title="Réglages" />
      <div className="space-y-4">
        <Section title="Profil">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) rename.mutate(); }}>
            <div className="flex-1"><label className="label" htmlFor="name">Prénom</label><input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
            <button className="btn-ghost self-end" disabled={!name.trim() || name.trim() === user.display_name || rename.isPending}>Enregistrer</button>
          </form>
          <p className="mt-3 text-sm text-muted">{user.email}</p>
        </Section>

        <Section title="Apparence">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thème">
            {([["system", "Auto", Monitor], ["light", "Clair", Sun], ["dark", "Sombre", Moon]] as const).map(([value, label, Icon]) => (
              <button key={value} role="radio" aria-checked={theme === value} onClick={() => pickTheme(value)}
                className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border text-sm font-medium transition ${theme === value ? "border-pine bg-pine-soft text-pine" : "border-line text-muted hover:text-ink"}`}>
                <Icon size={20} strokeWidth={1.75} />{label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Lecture">
          <Line label="Afficher la traduction française" hint="Muhammad Hamidullah"><Switch label="Afficher la traduction" checked={s.show_translation} onChange={(v) => save.mutate({ show_translation: v })} /></Line>
          <Line label="Afficher la translittération" hint="Aide à la prononciation, en option"><Switch label="Afficher la translittération" checked={s.show_transliteration} onChange={(v) => save.mutate({ show_transliteration: v })} /></Line>
          <div className="py-3">
            <label className="flex items-center justify-between text-[15px] font-medium" htmlFor="scale">Taille du texte arabe <span className="tabular-nums text-muted">{s.arabic_font_scale} %</span></label>
            <input id="scale" type="range" min={80} max={160} step={10} defaultValue={s.arabic_font_scale} onChange={(e) => save.mutate({ arabic_font_scale: Number(e.target.value) })} className="mt-3 w-full accent-[rgb(var(--pine))]" />
          </div>
          <div className="py-3">
            <label className="label" htmlFor="reciter">Récitateur</label>
            <select id="reciter" className="field" value={s.reciter} onChange={(e) => save.mutate({ reciter: e.target.value })}>{RECITERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <div className="py-3">
            <label className="flex items-center justify-between text-[15px] font-medium" htmlFor="cap">Révisions max. par jour <span className="tabular-nums text-muted">{s.max_reviews_per_day}</span></label>
            <input id="cap" type="range" min={10} max={150} step={10} defaultValue={s.max_reviews_per_day} onChange={(e) => save.mutate({ max_reviews_per_day: Number(e.target.value) })} className="mt-3 w-full accent-[rgb(var(--pine))]" />
            <p className="mt-1 text-xs text-muted">Au-delà, les versets les moins urgents attendent le lendemain.</p>
          </div>
        </Section>

        <Reminders />

        <Section title="Sources et licences">
          <p className="text-sm leading-relaxed text-muted">Texte arabe : édition Uthmani du Tanzil Project (tanzil.net), CC BY 3.0, reproduit sans modification. Traduction française : Muhammad Hamidullah. Translittération et audio fournis via alquran.cloud / Islamic Network. Le texte n'est jamais généré par l'application.</p>
        </Section>

        <button className="btn-ghost w-full" onClick={() => void logout().then(() => navigate("/connexion"))}><LogOut size={17} />Se déconnecter</button>
      </div>
    </>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (<section className="card p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2>{action}</div>{children}</section>);
}
function Line({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (<div className="flex items-center justify-between gap-4 border-b border-line/60 py-3"><div><p className="text-[15px] font-medium">{label}</p>{hint && <p className="text-xs text-muted">{hint}</p>}</div>{children}</div>);
}

function Reminders() {
  const { data, isLoading } = useReminders();
  const invalidate = useInvalidateProgress();
  const [editing, setEditing] = useState<Reminder | "new" | null>(null);
  const [permission, setPermission] = useState<string>(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const toggle = useMutation({ mutationFn: (r: Reminder) => api.updateReminder(r.id, { enabled: !r.enabled }), onSuccess: () => void invalidate() });

  return (
    <Section title="Rappels" action={<button className="btn-quiet !min-h-10" onClick={() => setEditing("new")}><Plus size={17} />Ajouter</button>}>
      {permission === "default" && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-pine-soft p-3 text-sm text-pine">
          <span>Autorise les notifications pour recevoir tes rappels sur cet appareil.</span>
          <button className="btn !min-h-9 shrink-0 bg-pine px-3 text-pine-on" onClick={() => void Notification.requestPermission().then(setPermission)}>Autoriser</button>
        </div>
      )}
      {permission === "denied" && <p className="mb-3 text-sm text-muted">Les notifications sont bloquées dans ton navigateur : tes rappels s'afficheront dans l'application.</p>}
      {isLoading ? <Skeleton className="h-16" /> : !data?.length ? (
        <EmptyState icon={Bell} title="Aucun rappel">Un rappel à heure fixe est le meilleur allié de la régularité.</EmptyState>
      ) : (
        <ul className="divide-y divide-line/60">
          {data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(r)} aria-label={`Modifier le rappel de ${r.time}`}>
                <p className="flex items-baseline gap-2"><span className="text-2xl font-semibold tabular-nums">{r.time}</span><span className="text-sm text-muted">{REMINDER_KINDS.find((k) => k.value === r.kind)?.label} · {r.days.length === 7 ? "tous les jours" : r.days.map((d) => DAY_NAMES[d]?.slice(0, 3)).join(" ")}</span></p>
                <p className="truncate text-sm text-muted">« {r.preview} »</p>
              </button>
              <Switch label={`Activer le rappel de ${r.time}`} checked={r.enabled} onChange={() => toggle.mutate(r)} />
            </li>
          ))}
        </ul>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nouveau rappel" : "Modifier le rappel"}>
        {editing !== null && <ReminderForm reminder={editing === "new" ? null : editing} onDone={() => { setEditing(null); void invalidate(); }} />}
      </Sheet>
    </Section>
  );
}

export function ReminderFields({ value, onChange }: { value: ReminderInput; onChange: (v: ReminderInput) => void }) {
  return (
    <div className="space-y-5">
      <div><label className="label" htmlFor="r-time">Heure</label><input id="r-time" type="time" className="field text-2xl" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} required /></div>
      <div>
        <span className="label">Jours</span>
        <div className="flex justify-between gap-1">
          {DAYS.map((d, i) => { const on = value.days.includes(i); return (
            <button key={i} type="button" aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => onChange({ ...value, days: on ? value.days.filter((x) => x !== i) : [...value.days, i].sort() })}
              className={`grid h-11 w-11 place-items-center rounded-full text-sm font-semibold transition ${on ? "bg-pine text-pine-on" : "bg-sunken text-muted"}`}>{d}</button>); })}
        </div>
      </div>
      <div>
        <span className="label">Type de rappel</span>
        <div className="flex flex-wrap gap-2">{REMINDER_KINDS.map((k) => <button key={k.value} type="button" aria-pressed={value.kind === k.value} className={`chip ${value.kind === k.value ? "chip-on" : ""}`} onClick={() => onChange({ ...value, kind: k.value })}>{k.label}</button>)}</div>
      </div>
      <div>
        <label className="label" htmlFor="r-freq">Fréquence</label>
        <select id="r-freq" className="field" value={value.frequency} onChange={(e) => onChange({ ...value, frequency: e.target.value as ReminderFrequency })}>{FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
      </div>
    </div>
  );
}

function ReminderForm({ reminder, onDone }: { reminder: Reminder | null; onDone: () => void }) {
  const [value, setValue] = useState<ReminderInput>(reminder ? { kind: reminder.kind, time: reminder.time, days: reminder.days, frequency: reminder.frequency, enabled: reminder.enabled } : { kind: "session", time: "20:30", days: [0, 1, 2, 3, 4, 5, 6], frequency: "daily", enabled: true });
  const onError = (e: unknown) => toast(e instanceof ApiError ? e.message : "Une erreur est survenue.", "error");
  const save = useMutation({ mutationFn: () => (reminder ? api.updateReminder(reminder.id, value) : api.createReminder(value)), onSuccess: onDone, onError });
  const remove = useMutation({ mutationFn: () => api.deleteReminder(reminder!.id), onSuccess: onDone, onError });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <ReminderFields value={value} onChange={setValue} />
      {reminder && <p className="mt-4 rounded-xl bg-sunken/70 p-3 text-sm text-muted">Aperçu : « {reminder.preview} »</p>}
      <div className="mt-6 flex gap-2">
        {reminder && <button type="button" className="btn-ghost !px-4 text-clay" onClick={() => remove.mutate()} aria-label="Supprimer le rappel"><Trash2 size={17} /></button>}
        <button className="btn-primary flex-1" disabled={save.isPending || value.days.length === 0}>Enregistrer</button>
      </div>
    </form>
  );
}
