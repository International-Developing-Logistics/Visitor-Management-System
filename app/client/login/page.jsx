"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BrandHeader from "@/components/BrandHeader";

// Separate from /admin/login on purpose - a client should never land on
// the staff sign-in page, and signing in here never grants /admin, /guard,
// or /staff access (see components/ClientGuard.jsx and
// CLIENT_PORTAL_AND_GATE_CHECK_DESIGN.md Part B).
export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setSubmitting(false);
      setError("Incorrect email or password.");
      return;
    }

    const { data: accountRow } = await supabase
      .from("client_accounts")
      .select("client_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!accountRow) {
      await supabase.auth.signOut();
      setSubmitting(false);
      setError("This login doesn't have access to the client portal.");
      return;
    }

    router.push("/client");
  };

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Client Portal" />
      </div>
      <div className="card" style={{ maxWidth: 380 }}>
        <h3>Client sign in</h3>
        <form onSubmit={submit}>
          <label htmlFor="client-login-email">Email</label>
          <input id="client-login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="client-login-password">Password</label>
          <input id="client-login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
