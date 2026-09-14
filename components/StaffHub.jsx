"use client";

import Link from "next/link";
import BrandHeader from "@/components/BrandHeader";
import { facilityPath, DEFAULT_FACILITY } from "@/lib/facilities";

// Staff Home (formerly "Staff Hub") - item #4 of the IA overhaul spec:
// lead with the three primary actions, then requests/guests lookup and
// support, and move the games out to a separate "Staff Extras" page/section
// so they don't compete with work tasks for attention.
function PrimaryAction({ href, title, description }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "16px 18px",
        border: "1px solid var(--accent)",
        background: "var(--accent-soft)",
        borderRadius: 10,
        marginBottom: 10,
        textDecoration: "none",
        color: "var(--ink)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
      <div className="helper-text" style={{ marginTop: 0 }}>{description}</div>
    </Link>
  );
}

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

function SectionLabel({ children }) {
  return (
    <p
      className="helper-text"
      style={{ marginTop: 20, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}
    >
      {children}
    </p>
  );
}

export default function StaffHub({ facility }) {
  const p = (path) => facilityPath(facility, path);

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Home" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Home</h3>
        <p className="helper-text" style={{ marginTop: 0, marginBottom: 16 }}>
          Everything you need day-to-day, in one place.
        </p>

        <PrimaryAction
          href="/request-invite"
          title="Invite Guest"
          description="Send a pre-registration request so your guest is expected at the gate"
        />
        <PrimaryAction
          href={p("/vehicle-request")}
          title="Request Vehicle"
          description="Car, truck, etc. - you'll get a status link by email"
        />
        <PrimaryAction
          href={`/equipment-log?facility=${facility.key}`}
          title="Equipment Log"
          description="Scan the QR code on the equipment - or pick it from the list here"
        />

        <SectionLabel>My Guests</SectionLabel>
        <ServiceLink
          href="/find-registration"
          title="Find my guest"
          description="Look up a pre-registration you sent by email"
        />

        <SectionLabel>Support</SectionLabel>
        <ServiceLink
          href={p("/it-tickets")}
          title="IT Tickets"
          description="Report broken hardware, software issues, or account access problems"
        />
        <ServiceLink
          href="/recommendations"
          title="Feature Requests"
          description="Tell us what you'd like added to this app - anonymous"
        />

        <SectionLabel>Staff Extras</SectionLabel>
        <ServiceLink
          href={p("/staff/extras")}
          title="Games"
          description="Hangman and Crossword - shared with everyone on shift"
        />

        <SectionLabel>Staff & Security</SectionLabel>
        <ServiceLink
          href={`/admin/login?facility=${facility.key}`}
          title="Staff / Security sign in"
          description="Staff, Admin, and Security Guard access"
        />
      </div>

      <p className="helper-text" style={{ marginTop: 18, textAlign: "center" }}>
        <Link href={facility.key === DEFAULT_FACILITY ? "/" : `/${facility.key}`}>← Back to visitor check-in</Link>
      </p>
    </main>
  );
}
