import type { AyahStatus, DayStatus, Rating } from "@/types/api";

export const STATUS_LABEL: Record<AyahStatus, string> = {
  to_learn: "À apprendre", in_progress: "En cours", learned: "Appris", to_review: "À réviser", mastered: "Maîtrisé",
};

/** 0 = untouched … 4 = anchored. Drives every mastery colour in the app. */
export function masteryStep(mastery: number, started = mastery > 0): 0 | 1 | 2 | 3 | 4 {
  if (!started) return 0;
  if (mastery >= 85) return 4;
  if (mastery >= 60) return 3;
  if (mastery >= 35) return 2;
  return 1;
}

export const STEP_BG = ["bg-m-0", "bg-m-1", "bg-m-2", "bg-m-3", "bg-m-4"] as const;
export const STEP_LABEL = ["Pas encore vu", "Fragile", "En consolidation", "Solide", "Ancré"] as const;

export const RATINGS: { value: Rating; label: string; hint: string; key: string }[] = [
  { value: "forgotten", label: "Oublié", hint: "Je n'ai pas su", key: "1" },
  { value: "hard", label: "Difficile", hint: "Avec beaucoup d'aide", key: "2" },
  { value: "medium", label: "Moyen", hint: "Quelques hésitations", key: "3" },
  { value: "easy", label: "Facile", hint: "Fluide", key: "4" },
  { value: "very_easy", label: "Très facile", hint: "Sans réfléchir", key: "5" },
];

export function suggestRating(mistakes: number, hints: number, wordCount: number): Rating {
  const slips = mistakes + hints;
  if (slips === 0) return "easy";
  if (slips === 1) return "medium";
  if (slips <= Math.max(2, Math.ceil(wordCount / 3))) return "hard";
  return "forgotten";
}

export const DAY_STATUS: Record<DayStatus, { label: string; dot: string }> = {
  done: { label: "Objectif atteint", dot: "bg-state-done" },
  partial: { label: "Partiellement atteint", dot: "bg-state-partial" },
  missed: { label: "Jour sans session", dot: "bg-state-missed" },
  review: { label: "Révision", dot: "bg-state-review" },
  today: { label: "Aujourd'hui", dot: "bg-line" },
  rest: { label: "—", dot: "bg-line/60" },
  future: { label: "À venir", dot: "bg-transparent" },
};
