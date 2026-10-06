import { useEffect } from "react";

import { api } from "@/services/api";
import { toast } from "@/stores/toast";
import type { Reminder } from "@/types/api";

import { useReminders } from "./queries";

function msUntil(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const at = new Date();
  at.setHours(h ?? 0, m ?? 0, 0, 0);
  return at.getTime() - Date.now();
}

/**
 * While the app is open, fires today's reminders at their time (system notification when allowed,
 * in-app toast otherwise). Delivery when the app is closed is the job of the backend worker + a push channel.
 */
export function useLocalReminders() {
  const { data } = useReminders();
  useEffect(() => {
    if (!data) return;
    const weekday = (new Date().getDay() + 6) % 7; // 0 = Monday, like the API
    const timers = data
      .filter((r: Reminder) => r.enabled && r.days.includes(weekday) && msUntil(r.time) > 0)
      .map((r) =>
        window.setTimeout(async () => {
          const fresh = (await api.reminders().catch(() => data)).find((x) => x.id === r.id) ?? r;
          if (fresh.frequency === "if_pending" && !fresh.pending) return;
          if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            new Notification("Thabāt", { body: fresh.preview, icon: "/favicon.svg", tag: `reminder-${r.id}` });
          } else toast(fresh.preview);
        }, msUntil(r.time)),
      );
    return () => timers.forEach(clearTimeout);
  }, [data]);
}
