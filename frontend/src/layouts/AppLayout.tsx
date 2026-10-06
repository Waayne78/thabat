import { CalendarDays, Grid3x3, Home, Play, Settings, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Logo } from "@/components/Logo";
import { useLocalReminders } from "@/hooks/useLocalReminders";

const NAV: { to: string; label: string; icon: LucideIcon; mobile: boolean }[] = [
  { to: "/", label: "Aujourd'hui", icon: Home, mobile: true },
  { to: "/ancrage", label: "Ancrage", icon: Grid3x3, mobile: true },
  { to: "/objectifs", label: "Objectifs", icon: Target, mobile: false },
  { to: "/calendrier", label: "Calendrier", icon: CalendarDays, mobile: true },
  { to: "/parcours", label: "Parcours", icon: TrendingUp, mobile: true },
  { to: "/reglages", label: "Réglages", icon: Settings, mobile: false },
];

export function AppLayout() {
  const navigate = useNavigate();
  useLocalReminders();
  const mobile = NAV.filter((n) => n.mobile);
  return (
    <div className="mx-auto min-h-dvh max-w-6xl lg:grid lg:grid-cols-[232px_1fr] lg:gap-8 lg:px-6">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-pine focus:px-4 focus:py-2 focus:text-pine-on">Aller au contenu</a>

      {/* desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col py-8 lg:flex">
        <div className="px-3"><Logo /></div>
        <nav className="mt-10 flex flex-col gap-1" aria-label="Navigation principale">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition ${isActive ? "bg-pine-soft text-pine" : "text-muted hover:bg-sunken hover:text-ink"}`}>
              <Icon size={19} strokeWidth={1.75} />{label}
            </NavLink>
          ))}
        </nav>
        <button className="btn-primary mt-8" onClick={() => navigate("/session")}><Play size={17} fill="currentColor" />Ma session</button>
        
      </aside>

      <main id="main" className="min-w-0 px-4 pb-32 pt-6 sm:px-6 lg:px-0 lg:pb-16 lg:pt-10">
        <div className="mx-auto max-w-2xl animate-rise lg:max-w-3xl"><Outlet /></div>
      </main>

      {/* mobile tab bar with the session button in the middle */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navigation principale">
        <div className="mx-auto grid max-w-md grid-cols-5 items-center">
          {mobile.slice(0, 2).map((n) => <Tab key={n.to} {...n} />)}
          <div className="grid place-items-center">
            <button onClick={() => navigate("/session")} aria-label="Ouvrir ma session"
              className="my-1.5 grid h-11 w-14 place-items-center rounded-xl bg-pine text-pine-on">
              <Play size={18} fill="currentColor" />
            </button>
          </div>
          {mobile.slice(2).map((n) => <Tab key={n.to} {...n} />)}
        </div>
      </nav>
    </div>
  );
}

function Tab({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => `flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${isActive ? "text-pine" : "text-muted"}`}>
      {({ isActive }) => (<><Icon size={21} strokeWidth={isActive ? 2.1 : 1.6} />{label}</>)}
    </NavLink>
  );
}
