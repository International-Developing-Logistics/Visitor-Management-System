"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrandHeader from "@/components/BrandHeader";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { FACILITIES, DEFAULT_FACILITY, facilityPath } from "@/lib/facilities";

// Manual entry point linked from the Staff Hub, for when someone doesn't
// have the physical QR code in front of them (or it's damaged/missing).
// The QR codes themselves deep-link straight to /equipment-log/<unitId>
// and skip this list entirely.
export default function EquipmentLogIndexPage({ searchParams }) {
  const facilityKey = FACILITIES[searchParams?.facility] ? searchParams.facility : DEFAULT_FACILITY;
  const facility = FACILITIES[facilityKey];
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/equipment-log?facility=${facilityKey}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setUnits(d.units || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [facilityKey]);

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Equipment Log" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Equipment</h3>
        <p className="helper-text" style={{ marginBottom: 16 }}>
          Normally you'd scan the QR code on the equipment itself - use this list only if that's not available.
        </p>

        {error && <p className="error-text">{error}</p>}
        {loading && <p className="helper-text">Loading…</p>}
        {!loading && units.length === 0 && <p className="helper-text">No equipment configured for this facility yet.</p>}

        {!loading &&
          units.map((u) => (
            <Link
              key={u.id}
              href={`/equipment-log/${u.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                border: "1px solid var(--line)",
                borderRadius: 10,
                marginBottom: 10,
                textDecoration: "none",
                color: "var(--ink)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{u.name}</div>
                <div className="helper-text" style={{ marginTop: 0 }}>
                  {u.active
                    ? `Checked out to ${u.active.user_name} since ${formatInCompanyTimezone(u.active.checked_out_at)}`
                    : "Available"}
                </div>
              </div>
              <span className={`badge ${u.active ? "gate_pending" : "checked_in"}`}>
                {u.active ? "In use" : "Available"}
              </span>
            </Link>
          ))}

        <p className="helper-text" style={{ marginTop: 18, textAlign: "center" }}>
          <Link href={facilityPath(facility, "/staff")}>← Back to Home</Link>
        </p>
      </div>
    </main>
  );
}
