export type Rating = "very_easy" | "easy" | "medium" | "hard" | "forgotten";
export type AyahStatus = "to_learn" | "in_progress" | "learned" | "to_review" | "mastered";
export type DayStatus = "done" | "partial" | "review" | "missed" | "today" | "rest" | "future";
export type Theme = "system" | "light" | "dark";

export interface Settings {
  theme: Theme;
  timezone: string;
  show_translation: boolean;
  show_transliteration: boolean;
  reciter: string;
  arabic_font_scale: number;
  max_reviews_per_day: number;
  intention: string | null;
  onboarding_completed: boolean;
}
export interface User { id: number; email: string; display_name: string; settings: Settings }
export interface TokenResponse { access_token: string; expires_in: number; user: User }

export interface Surah { id: number; name_ar: string; name_translit: string; revelation: string; ayah_count: number; first_ayah_id: number }
export interface Juz { id: number; first_ayah_id: number; last_ayah_id: number; ayah_count: number }
export interface Ayah {
  id: number; surah_id: number; surah_name: string; surah_name_ar: string; number: number; juz: number;
  hizb_quarter: number; page: number; text_ar: string; translation: string | null; transliteration: string | null;
  audio_url: string;
}
export interface SurahDetail extends Surah { ayahs: Ayah[] }

export interface Plan {
  total: number; learned: number; remaining: number; days_left: number; daily_new: number; weekly_new: number;
  today_new_target: number; expected_learned: number; delta_verses: number; delta_days: number;
  status: "ahead" | "on_track" | "behind" | "completed"; catchup_extra: number; catchup_days: number;
  margin_days: number; projected_end: string | null; required_daily: number; headline: string; message: string;
}
export interface PaceOption {
  key: "gentle" | "balanced" | "intense"; label: string; daily_new: number; weekly_new: number;
  finish_date: string; margin_days: number; minutes_per_day: number; recommended: boolean;
}
export interface GoalPreview { total: number; remaining: number; days_left: number; options: PaceOption[] }

export type GoalKind = "scope" | "count" | "daily" | "weekly";
export interface GoalItemInput { kind: "juz" | "surah" | "range"; ref_id?: number; first_ayah_id?: number; last_ayah_id?: number }
export interface GoalItem { id: number; kind: string; ref_id: number | null; first_ayah_id: number; last_ayah_id: number; label: string }
export interface GoalInput {
  title: string; kind: GoalKind; target_date?: string | null; target_count?: number | null; daily_new?: number | null;
  learning_order?: "short_first" | "mushaf"; is_primary?: boolean; items?: GoalItemInput[];
}
export interface Goal {
  id: number; title: string; kind: GoalKind; start_date: string; target_date: string | null; target_count: number | null;
  daily_new: number | null; learning_order: string; is_primary: boolean; status: string; items: GoalItem[];
  total: number; done: number; mastered: number; progress_pct: number; days_left: number | null; summary: string;
  plan: Plan | null;
}

export type StatusCounts = Record<AyahStatus, number>;
export interface Streak { current: number; best: number; active_today: boolean }
export interface ReviewItem {
  ayah: Ayah; mastery: number; status: AyahStatus; priority: number; due_date: string; overdue_days: number;
  lapses: number; repetitions: number;
}
export interface Today {
  date: string; display_name: string; streak: Streak; new_done: number; review_done: number; seconds_today: number;
  goal: { id: number; title: string; target_date: string; start_date: string } | null;
  plan: Plan | null; progress_pct: number; counts: StatusCounts | null; learned?: number; mastered?: number; total?: number;
  new_target: number; new_ayahs: Ayah[]; reviews: ReviewItem[]; review_total_due: number; estimated_minutes: number;
  status: DayStatus; all_done?: boolean;
}

export interface MapCell { ayah_id: number; number: number; mastery: number; status: AyahStatus; due_date: string | null }
export interface MapSurah { id: number; name: string; name_ar: string; ayah_count: number; juz: number | null; mastery: number; learned: number; cells: MapCell[] }
export interface Overview {
  goal: { id: number; title: string; target_date: string } | null; surahs: MapSurah[];
  recently_mastered: { ayah_id: number; surah_name: string; number: number; mastery: number; mastered_at: string }[];
  counts: StatusCounts | null; progress_pct: number; total?: number;
}

export interface CalendarDay { date: string; status: DayStatus; new: number; reviewed: number; seconds: number; target_new: number }
export interface CalendarData { days: CalendarDay[]; streak: Streak; tracking_since: string | null; target_date: string | null }

export interface Level { level: number; name: string; points: number; floor: number; next_threshold: number | null; next_name: string | null; progress_pct: number }
export interface AchievementDef { code: string; icon: string; title: string; description: string }
export interface Achievement extends AchievementDef { unlocked: boolean; unlocked_at: string | null }
export interface Achievements { level: Level; levels: { level: number; name: string; threshold: number }[]; achievements: Achievement[] }

export interface WeekStat { week_start: string; new: number; reviewed: number; seconds: number }
export interface Statistics {
  learned: number; mastered: number; reviews: number; seconds: number;
  best_day: { date: string; new: number; reviewed: number } | null;
  current_streak: number; best_streak: number; active_days: number; daily_average: number; mastery_rate: number;
  this_week: WeekStat; last_week: WeekStat;
  daily: { date: string; new: number; reviewed: number; seconds: number; mastery: number | null }[];
  weekly: WeekStat[]; mastery_distribution: { label: string; count: number }[]; level: Level;
}

export interface RecordResult {
  ayah_id: number; kind: "learn" | "review"; mastery_before: number; mastery_after: number; status: AyahStatus;
  due_date: string; interval_days: number; newly_learned: boolean; newly_mastered: boolean; unlocked: AchievementDef[];
}
export interface SessionSummary { id: number; new_count: number; review_count: number; duration_seconds: number; streak: Streak; level: Level }

export type ReminderKind = "session" | "review" | "deadline" | "encouragement";
export type ReminderFrequency = "daily" | "if_pending" | "weekly";
export interface Reminder { id: number; kind: ReminderKind; time: string; days: number[]; frequency: ReminderFrequency; enabled: boolean; preview: string; pending: boolean }
export type ReminderInput = Omit<Reminder, "id" | "preview" | "pending">;
