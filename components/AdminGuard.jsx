"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// requiredRole: "staff" (default) — any signed-in account, admin or guard.
//               "admin" — blocks guard accounts entirely (used to wrap
//               everything under /admin and /preregister).
export default function AdminGuard({ children, requiredRole = "staff" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | ok | denied
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setStatus("ok");
      return;
    }

    let active = true;

    async function check(session) {
      if (!session) {
        router.replace("/admin/login");
        return;
      }
      if (requiredRole !== "admin") {
        if (active) setStatus("ok");
        return;
      }
      // Resolve the real role — no row in user_roles defaults to "admin",
      // matching the same default used server-side in lib/verifyAdmin.js.
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const role = roleRow?.role || "admin";
      if (!active) return;
      setStatus(role === "admin" ? "ok" : "denied");
    }

    supabase.auth.getSession().then(({ data }) => check(data?.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isLoginPage) router.replace("/admin/login");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [isLoginPage, router, requiredRole]);

  if (status === "checking") {
    return <p className="helper-text" style={{ padding: 24 }}>Loading…</p>;
  }

  if (status === "denied") {
    return (
      <main className="kiosk-shell">
        <div className="card" style={{ textAlign: "center" }}>
          <h3>Access restricted</h3>
          <p className="helper-text">Your account doesn't have access to this page.</p>
        </div>
      </main>
    );
  }

  return children;
}
