import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/services/api";

export const keys = {
  today: ["today"] as const,
  overview: ["overview"] as const,
  goals: ["goals"] as const,
  stats: ["statistics"] as const,
  achievements: ["achievements"] as const,
  reminders: ["reminders"] as const,
  calendar: (start: string, end: string) => ["calendar", start, end] as const,
  surahs: ["surahs"] as const,
};

export const useToday = () => useQuery({ queryKey: keys.today, queryFn: () => api.today() });
export const useOverview = () => useQuery({ queryKey: keys.overview, queryFn: api.overview });
export const useGoals = () => useQuery({ queryKey: keys.goals, queryFn: api.goals });
export const useStatistics = () => useQuery({ queryKey: keys.stats, queryFn: api.statistics });
export const useAchievements = () => useQuery({ queryKey: keys.achievements, queryFn: api.achievements });
export const useReminders = () => useQuery({ queryKey: keys.reminders, queryFn: api.reminders });
export const useCalendar = (start: string, end: string) => useQuery({ queryKey: keys.calendar(start, end), queryFn: () => api.calendar(start, end) });
export const useSurahs = (enabled = true) => useQuery({ queryKey: keys.surahs, queryFn: api.surahs, staleTime: Infinity, enabled });

/** Everything derived from progress changes together: one helper to refresh it all. */
export function useInvalidateProgress() {
  const qc = useQueryClient();
  return () => Promise.all(["today", "overview", "goals", "statistics", "achievements", "calendar", "reminders"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function useProgressMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const invalidate = useInvalidateProgress();
  return useMutation({ mutationFn: fn, onSuccess: () => { void invalidate(); } });
}
export const useJuz = (enabled = true) => useQuery({ queryKey: ["juz"], queryFn: api.juz, staleTime: Infinity, enabled });
