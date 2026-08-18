"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";
import BrandHeader from "@/components/BrandHeader";

function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const link = (href, label) => (
    <Link
      href={href}
      style={{
        color: pathname === href ? "var(--accent-dark)" : "var(--muted)",
        fontWeight: pathname === href ? 700 : 500,
        textDecoration: "none",
        fontSize: "0.92rem",
      }}
    >
      {label}
    </Link>
  );

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 960,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", gap: 22 }}>
        {link("/admin", "Dashboard")}
        {link("/admin/hosts", "Hosts")}
        {link("/admin/contractors", "Contractors")}
        {link("/admin/guard-logs", "Guard Log")}
        {link("/admin/vehicle-requests", "Vehicle Requests")}
        {link("/preregister", "Invite a guest")}
      </div>
      <button
        onClick={signOut}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          fontSize: "0.85rem",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Sign out
      </button>
    </div>
  );
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  return (
    <AdminGuard requiredRole="admin">
      <main className="kiosk-shell" style={{ alignItems: "center" }}>
        <div className="kiosk-header" style={{ maxWidth: 960 }}>
          <BrandHeader label="Admin" />
        </div>
        {!isLoginPage && <AdminNav />}
        {children}
      </main>
    </AdminGuard>
  );
}
