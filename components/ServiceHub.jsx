"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrandHeader from "@/components/BrandHeader";
import { facilityPath } from "@/lib/facilities";

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

export default function ServiceHub({ facility }) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const walkinUrl = origin ? `${origin}${facilityPath(facility, "/walkin")}` : "";
  const qrSrc = walkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(walkinUrl)}`
    : "";

  const p = (path) => facilityPath(facility, path);

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      {/* Kiosk-mode hero — kept exactly as before for the reception tablet:
          one big button, no menu, no decisions to make. */}
      <div className="card" style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "1.6rem" }}>Welcome to {facility.label}</h1>
        <p style={{ color: "var(--muted)", marginBottom: 28 }}>
          Scan the code with your phone, or tap below to check in on this screen.
        </p>

        {qrSrc && (
          <img
            src={qrSrc}
            alt="QR code to open the check-in form"
            width={200}
            height={200}
            style={{ margin: "0 auto 28px", display: "block" }}
          />
        )}

        <Link href={p("/walkin")}>
          <button className="btn btn-primary" style={{ marginTop: 0 }}>
            Check in on this tablet
          </button>
        </Link>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 4 }}>Other ways to get here</h3>
        <p className="helper-text" style={{ marginBottom: 18 }}>
          Choose whichever fits what brings you here today.
        </p>

        <p className="helper-text" style={{ marginTop: 0, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>
          Visitors
        </p>
        <ServiceLink
          href="/find-registration"
          title="I have a pre-registration"
          description="Look up your check-in link if you registered before arriving"
        />
        <ServiceLink
          href={p("/preregister-open")}
          title="Register before you arrive"
          description="Complete your details ahead of time for a faster check-in"
        />

        <p className="helper-text" style={{ marginTop: 20, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>
          Contractors
        </p>
        <ServiceLink
          href="/find-pass"
          title="I have a pass"
          description="Look up your pass link if you've already registered"
        />
        <ServiceLink
          href="/contractor-register"
          title="Register for a site pass"
          description="For contractors/vendors visiting for a project"
        />
      </div>

      <p className="helper-text" style={{ marginTop: 18, textAlign: "center" }}>
        Employee or staff member? <Link href={p("/staff")}>Staff &amp; business services →</Link>
      </p>
      <p className="helper-text" style={{ marginTop: 6, textAlign: "center" }}>
        Waiting around? <Link href="/crossword">Try our Crossword</Link>
      </p>
    </main>
  );
}
