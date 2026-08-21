"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { FACILITIES, DEFAULT_FACILITY } from "@/lib/facilities";

function safeNext(raw) {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return null;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const explicitNext = safeNext(params.get("next"));
  const rawFacility = params.get("facility");
  const facilityHint = FACILITIES[rawFacility] ? rawFacility : DEFAULT_FACILITY;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      setError("Incorrect email or password.");
      return;
    }

    if (explicitNext) {
      router.push(explicitNext);
      return;
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    const role = roleRow?.role || "admin";

    if (role === "guard") {
      router.push(facilityHint === DEFAULT_FACILITY ? "/guard" : `/${facilityHint}/guard`);
      return;
    }
    router.push("/admin");
  };

  return (
    <div className="card" style={{ maxWidth: 380 }}>
      <h3>Staff sign in</h3>
      <form onSubmit={submit}>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="helper-text" style={{ marginTop: 18 }}>
        If you need any assistance find me before I find you.
      </p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<p className="helper-text" style={{ padding: 24 }}>Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
