"use client";

import { usePathname } from "next/navigation";
import ClientGuard from "@/components/ClientGuard";

// Minimal layout on purpose - no AppShell sidebar, no admin nav, nothing
// that hints at the rest of the operations app. A client's whole world
// here is "My Files".
export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/client/login";

  if (isLoginPage) {
    return <ClientGuard>{children}</ClientGuard>;
  }

  return (
    <ClientGuard>
      <main className="kiosk-shell">{children}</main>
    </ClientGuard>
  );
}
