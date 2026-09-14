"use client";

import { usePathname } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import AppShell from "@/components/AppShell";
import BrandHeader from "@/components/BrandHeader";
import { FacilityProvider } from "@/lib/facilityContext";

// The old horizontal AdminNav has been replaced by the unified sidebar
// shell (components/AppShell.jsx) — see that file for the nav tree and
// role filtering. The login page is the one exception: it's not part of
// the operations UI, so it keeps the plain centered kiosk-style layout
// instead of getting a sidebar around a sign-in form.
export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return (
      <AdminGuard requiredRole="admin">
        <main className="kiosk-shell">
          <div className="kiosk-header">
            <BrandHeader label="Admin" />
          </div>
          {children}
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard requiredRole="admin">
      <FacilityProvider>
        <AppShell role="admin">{children}</AppShell>
      </FacilityProvider>
    </AdminGuard>
  );
}
