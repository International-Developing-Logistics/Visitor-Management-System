"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setChecked(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session) {
        router.replace("/admin/login");
      } else {
        setChecked(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isLoginPage) router.replace("/admin/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [isLoginPage, router]);

  if (!checked) return <p className="helper-text" style={{ padding: 24 }}>Loading…</p>;
  return children;
}
