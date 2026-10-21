"use client";

import Link from "next/link";
import BrandHeader from "@/components/BrandHeader";
import { facilityPath, DEFAULT_FACILITY } from "@/lib/facilities";

// Staff Extras - the non-work stuff (Hangman, Crossword) that used to live
// inline on the Staff Hub. Split out per the IA overhaul so the Home page
// can lead with primary work actions, per item #4 of the spec ("move
// Hangman and Crossword to Staff Extras").
function ExtraLink({ href, title, description }) {
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

export default function StaffExtras({ facility }) {
  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Staff Extras" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Staff Extras 🎮</h3>
        <p className="helper-text" style={{ marginTop: 0, marginBottom: 16 }}>
          A couple of shared games for downtime.
        </p>

        <ExtraLink
          href="/hangman"
          title="Hangman"
          description="One shared word for everyone - take turns guessing letters"
        />
        <ExtraLink
          href="/crossword"
          title="Crossword"
          description="Logistics/freight themed - one shared grid for everyone"
        />
      </div>

      <p className="helper-text" style={{ marginTop: 18, textAlign: "center" }}>
        <Link href={facilityPath(facility, "/staff")}>← Back to Home</Link>
      </p>
    </main>
  );
}
