import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { LogoMark } from "@/components/Logo";
import { PageSkeleton, Toaster } from "@/components/ui";
import { AppLayout } from "@/layouts/AppLayout";
import Home from "@/pages/Home";
import { useAuth } from "@/stores/auth";
import { useTheme } from "@/stores/theme";

const Session = lazy(() => import("@/pages/Session"));
const Mastery = lazy(() => import("@/pages/Mastery"));
const Goals = lazy(() => import("@/pages/Goals"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Journey = lazy(() => import("@/pages/Journey"));
const Settings = lazy(() => import("@/pages/Settings"));
const Login = lazy(() => import("@/pages/Login"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Chargement de Thabāt">
      <LogoMark size={48} className="animate-pulse text-pine" />
    </div>
  );
}

export default function App() {
  const { status, user, bootstrap } = useAuth();
  const setTheme = useTheme((s) => s.setTheme);
  useEffect(() => { void bootstrap(); }, [bootstrap]);
  // the account's theme wins over the device's last choice
  const savedTheme = user?.settings.theme;
  useEffect(() => { if (savedTheme) setTheme(savedTheme); }, [savedTheme, setTheme]);

  if (status === "loading") return <Splash />;
  const ready = status === "authenticated" && !!user?.settings.onboarding_completed;
  return (
    <>
      <Toaster />
      <Suspense fallback={<div className="mx-auto max-w-2xl p-6"><PageSkeleton /></div>}>
        <Routes>
          {ready ? (
            <>
              <Route element={<AppLayout />}>
                <Route index element={<Home />} />
                <Route path="ancrage" element={<Mastery />} />
                <Route path="objectifs" element={<Goals />} />
                <Route path="calendrier" element={<Calendar />} />
                <Route path="parcours" element={<Journey />} />
                <Route path="reglages" element={<Settings />} />
              </Route>
              <Route path="session" element={<Session />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="bienvenue" element={<Onboarding />} />
              {status === "anonymous" && <Route path="connexion" element={<Login />} />}
              <Route path="*" element={<Navigate to="/bienvenue" replace />} />
            </>
          )}
        </Routes>
      </Suspense>
    </>
  );
}
