"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GovernorNav from "@/app/components/governor-nav";
import { loginAdmin } from "@/app/lib/console-api";

const ADMIN_TOKEN_KEY = "governor_admin_token";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@governor.local");
  const [password, setPassword] = useState("governor_admin_123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const existing = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    if (existing) router.replace("/console");
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await loginAdmin(email, password);
      window.localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
      router.push("/console");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="demo-page-shell">
      <div className="hero-grid" />
      <GovernorNav rightSlot={<Link className="demo-console-link" href="/console">Open console</Link>} />

      <main className="demo-auth-main container-wide">
        <section className="demo-auth-hero">
          <p className="demo-overline">Operations view</p>
          <h1 className="serif-title">Sign in to access the Governor Console.</h1>
          <p>
            This sandbox console demonstrates deterministic spend controls for agents. Use the seeded admin account
            for local demo mode.
          </p>
        </section>

        <section className="surface-card demo-auth-card">
          <div className="demo-auth-head">
            <h2>Admin Sign In</h2>
            <p>Use seeded credentials to unlock policy controls and live transaction simulation.</p>
          </div>

          <form className="demo-auth-form" onSubmit={handleSubmit}>
            <label className="field-wrap">
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label className="field-wrap">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" className="btn-primary demo-auth-submit" disabled={busy}>
              {busy ? "Signing in..." : "Unlock Console"}
            </button>
            {error && <p className="demo-error">{error}</p>}
          </form>
        </section>
      </main>
    </div>
  );
}
