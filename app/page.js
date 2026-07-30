"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const walkinUrl = origin ? `${origin}/walkin` : "";
  const qrSrc = walkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(walkinUrl)}`
    : "";

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <div className="brand">
          Reception<span className="dot">·</span>Check-in
        </div>
      </div>

      <div className="card" style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "1.6rem" }}>Welcome</h1>
        <p style={{ color: "var(--muted)", marginBottom: 28 }}>
          Scan the code with your phone, or tap below to check in on this screen.
        </p>

        {qrSrc && (
          <img
            src={qrSrc}
            alt="QR code to open the check-in form"
            width={220}
            height={220}
            style={{ margin: "0 auto 28px", display: "block" }}
          />
        )}

        <Link href="/walkin">
          <button className="btn btn-primary" style={{ marginTop: 0 }}>
            Check in on this tablet
          </button>
        </Link>

        <p className="helper-text" style={{ marginTop: 22 }}>
          Pre-registered? Use the link from your invitation email instead.
        </p>
      </div>
    </main>
  );
}
