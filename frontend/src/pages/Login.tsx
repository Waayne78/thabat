import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Logo } from "@/components/Logo";
import { api } from "@/services/api";
import { ApiError } from "@/services/http";
import { useAuth } from "@/stores/auth";

export default function Login() {
  const accept = useAuth((s) => s.accept);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      accept(await api.login({ email, password }));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="animate-rise">
        <Logo size={30} />
        <h1 className="mt-8 text-3xl font-bold">Connexion</h1>
        <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
          <div><label className="label" htmlFor="email">Adresse e-mail</label><input id="email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="label" htmlFor="password">Mot de passe</label><input id="password" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {error && <p className="rounded-xl bg-clay-soft px-4 py-3 text-sm font-medium text-clay" role="alert">{error}</p>}
          <button className="btn-primary min-h-[52px] w-full" disabled={busy || !email || !password}>{busy ? "Connexion…" : "Se connecter"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">Première visite ? <Link to="/bienvenue" className="font-semibold text-pine">Créer un compte</Link></p>
      </div>
    </main>
  );
}
