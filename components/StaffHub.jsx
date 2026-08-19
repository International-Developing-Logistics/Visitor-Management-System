"use client";

import Link from "next/link";
import BrandHeader from "@/components/BrandHeader";
import { facilityPath, DEFAULT_FACILITY } from "@/lib/facilities";

function ServiceLink({ href, title, description }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "14px 16px",
        border: "1px solid var(--line)",
        borderRadius: 10,
        marginBottom: 10,
        textDecoration: "none",
        color: "var(--ink)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
      <div className="helper-text" style={{ marginTop: 0 }}>{description}</div>
    </Link>
  );
}

export default function StaffHub({ facility }) {
  const p = (path) => facilityPath(facility, path);

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Staff & business services" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Staff & business services</h3>
        <p className="helper-text" style={{ marginBottom: 18 }}>
          For employees, hosts, and staff — not for visitors.
        </p>

        <p className="helper-text" style={{ marginTop: 0, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>
          Company business
        </p>
        <ServiceLink
          href={p("/vehicle-request")}
          title="Request a company vehicle"
          description="Submit a request for coordinator approval"
        />
        <div style={{ padding: "10px 16px", marginBottom: 10, fontSize: "0.85rem", color: "var(--muted)" }}>
          To check a request's status, use the link from your confirmation screen or email — it's unique to
          your request, so there's no general status page to browse to.
        </div>
        <ServiceLink
          href={p("/equipment-request")}
          title="Request equipment"
          description="Pallet jack, forklift, or reach truck — reviewed by admin"
        />
        <ServiceLink
          href="/request-invite"
          title="Hosting a guest? Request an invite"
          description="Send reception a pre-registration request for your guest"
        />

        <p className="helper-text" style={{ marginTop: 20, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>
          Staff & security
        </p>
        <ServiceLink
          href={`/admin/login?facility=${facility.key}`}
          title="Staff / Security sign in"
          description="Reception, admin, and security guard access"
        />
      </div>

      <p className="helper-text" style={{ marginTop: 18, textAlign: "center" }}>
        <Link href={facility.key === DEFAULT_FACILITY ? "/" : `/${facility.key}`}>← Back to visitor check-in</Link>
      </p>
    </main>
  );
}
