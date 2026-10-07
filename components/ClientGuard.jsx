"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Gates the Client Portal (/client/**). Deliberately separate from
// AdminGuard - a client session must never be treated as staff (and vice
// versa), so this checks client_accounts directly rather than reusing any
// of AdminGuard's role logic. See
// CLIENT_PORTAL_AND_GATE_CHECK_DESIGN.md Part B.
export default function ClientGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | ok | denied
  const isLoginPage = pathname === "/client/login";

  useEffect(() => {
    if (isLoginPage) {
      setStatus("ok");
      return;
    }

    let active = true;

    async function check(session) {
      if (!session) {
        router.replace("/client/login");
        return;
      }

      const { data: accountRow } = await supabase
        .from("client_accounts")
        .select("client_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!active) return;
      setStatus(accountRow ? "ok" : "denied");
    }

    supabase.auth.getSession().then(({ data }) => check(data?.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isLoginPage) {
        router.replace("/client/login");
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [isLoginPage, pathname, router]);

  if (status === "checking") {
    return <p className="helper-text" style={{ padding: 24 }}>Loading…</p>;
  }

  if (status === "denied") {
    const signOut = async () => {
      await supabase.auth.signOut();
      router.replace("/client/login");
    };

    return (
      <main className="kiosk-shell">
        <div className="card" style={{ textAlign: "center" }}>
          <h3>Access restricted</h3>
          <p className="helper-text" style={{ marginBottom: 20 }}>
            This account doesn't have access to the client portal.
          </p>
          <button className="btn btn-primary" onClick={signOut} style={{ marginTop: 0 }}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return children;
}
