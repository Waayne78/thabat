import type {
  Achievements, Ayah, Juz, CalendarData, Goal, GoalInput, GoalItemInput, GoalPreview, Overview, Rating, RecordResult, Reminder,
  ReminderInput, ReviewItem, SessionSummary, Settings, Statistics, SurahDetail, Surah, Today, TokenResponse, User,
} from "@/types/api";
import { http } from "./http";

export const api = {
  register: (b: { email: string; password: string; display_name: string; timezone?: string }) => http.post<TokenResponse>("/auth/register", b),
  login: (b: { email: string; password: string }) => http.post<TokenResponse>("/auth/login", b),
  logout: () => http.post<null>("/auth/logout"),
  updateMe: (b: { display_name: string }) => http.patch<User>("/me", b),
  updateSettings: (b: Partial<Settings>) => http.patch<User>("/me/settings", b),

  surahs: () => http.get<Surah[]>("/surahs"),
  surah: (id: number) => http.get<SurahDetail>(`/surahs/${id}`),
  juz: () => http.get<Juz[]>("/juz"),
  ayah: (id: number) => http.get<Ayah>(`/ayahs/${id}`),

  goals: () => http.get<Goal[]>("/goals"),
  previewGoal: (b: { target_date: string; items: GoalItemInput[]; exclude_ayah_ids?: number[] }) => http.post<GoalPreview>("/goals/preview", b),
  createGoal: (b: GoalInput) => http.post<Goal>("/goals", b),
  updateGoal: (id: number, b: Partial<GoalInput> & { status?: string }) => http.patch<Goal>(`/goals/${id}`, b),
  deleteGoal: (id: number) => http.delete(`/goals/${id}`),

  today: (extra = 0) => http.get<Today>(`/progress/today${extra ? `?extra=${extra}` : ""}`),
  overview: () => http.get<Overview>("/progress"),
  calendar: (start: string, end: string) => http.get<CalendarData>(`/progress/calendar?start=${start}&end=${end}`),
  reviewsToday: () => http.get<{ total: number; items: ReviewItem[] }>("/reviews/today"),
  statistics: () => http.get<Statistics>("/statistics"),
  achievements: () => http.get<Achievements>("/achievements"),

  startSession: (mode: "daily" | "review" | "free") => http.post<{ id: number }>("/sessions", { mode }),
  finishSession: (id: number, duration_seconds: number) => http.post<SessionSummary>(`/sessions/${id}/finish`, { duration_seconds }),
  record: (kind: "new" | "review", b: { ayah_id: number; rating: Rating; mistakes: number; session_id: number | null }) =>
    http.post<RecordResult>(kind === "new" ? "/memorization" : "/reviews", b),

  markKnown: (ayah_ids: number[], level: "solid" | "approximate") => http.post<{ marked: number; skipped: number }>("/memorization/known", { ayah_ids, level }),

  reminders: () => http.get<Reminder[]>("/reminders"),
  createReminder: (b: ReminderInput) => http.post<Reminder>("/reminders", b),
  updateReminder: (id: number, b: Partial<ReminderInput>) => http.patch<Reminder>(`/reminders/${id}`, b),
  deleteReminder: (id: number) => http.delete(`/reminders/${id}`),
};
