"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/apiFetch";
import { useFacility } from "@/lib/facilityContext";
import { utcIsoToCompanyLocalDateValue } from "@/lib/timezone";

// Admin Home — item #9 of the IA overhaul: today's counts across the
// domains staff actually ask about (Visitors/Vehicles/Contractors), then
// an "Action Required" list of exactly what needs a decision right now,
// each item jumping straight to the right screen and tab. Everything here
// reuses the same list endpoints the domain pages already call — no new
// aggregation route, just re-slicing data those pages already fetch.
const QUICK_LINKS = [
  { href: "/preregister", label: "Invite a guest" },
  { href: "/admin/contractors", label: "Contractors" },
  { href: "/admin/vehicle-requests", label: "Vehicle requests" },
  { href: "/admin/equipment-log", label: "Equipment log" },
  { href: "/admin/recommendations", label: "Feature requests" },
];

function isToday(iso, todayStr) {
  return !!iso && utcIsoToCompanyLocalDateValue(iso) === todayStr;
}

function StatTile({ label, count }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 18px", minWidth: 120 }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{count}</div>
      <div className="helper-text" style={{ marginTop: 0 }}>{label}</div>
    </div>
  );
}

function ActionRow({ label, count, href }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        border: "1px solid var(--line)",
        borderRadius: 10,
        marginBottom: 8,
        textDecoration: "none",
        color: "var(--ink)",
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span className="badge gate_pending">{count}</span>
    </Link>
  );
}

export default function AdminHomePage() {
  const { facility } = useFacility();
  const [visitors, setVisitors] = useState([]);
  const [vehicleRequests, setVehicleRequests] = useState([]);
  const [equipmentRequests, setEquipmentRequests] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [v, vr, er, c] = await Promise.all([
        authFetch(`/api/admin/visitors?facility=${facility}`),
        authFetch(`/api/admin/vehicle-requests?facility=${facility}`),
        authFetch(`/api/admin/equipment-requests?facility=${facility}`),
        authFetch(`/api/admin/contractors`),
      ]);
      const [vData, vrData, erData, cData] = await Promise.all([v.json(), vr.json(), er.json(), c.json()]);
      if (!v.ok) throw new Error(vData.error);
      if (!vr.ok) throw new Error(vrData.error);
      if (!er.ok) throw new Error(erData.error);
      if (!c.ok) throw new Error(cData.error);
      setVisitors(vData.visitors || []);
      setVehicleRequests(vrData.requests || []);
      setEquipmentRequests(erData.requests || []);
      setContractors(cData.contractors || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [facility]);

  useEffect(() => {
    load();
  }, [load]);

  const todayStr = utcIsoToCompanyLocalDateValue(new Date().toISOString());

  const visitorsToday = visitors.filter((v) => isToday(v.created_at, todayStr)).length;
  const vehiclesToday = vehicleRequests.filter((r) => isToday(r.created_at, todayStr)).length;
  const contractorsToday = contractors.filter((c) => isToday(c.created_at, todayStr)).length;

  const actionItems = [
    {
      label: "Visitor requests awaiting approval",
      count: visitors.filter((v) => v.status === "requested").length,
      href: "/admin/visitors?tab=expected",
    },
    {
      label: "Visitors at the gate",
      count: visitors.filter((v) => v.status === "gate_pending").length,
      href: "/admin/visitors?tab=at_gate",
    },
    {
      label: "Vehicle requests pending",
      count: vehicleRequests.filter((r) => r.status === "pending").length,
      href: "/admin/vehicle-requests?tab=pending",
    },
    {
      label: "Equipment requests pending",
      count: equipmentRequests.filter((r) => r.status === "pending").length,
      href: "/admin/equipment-requests?tab=pending",
    },
    {
      label: "Contractor registrations pending review",
      count: contractors.filter((c) => c.status === "pending").length,
      href: "/admin/contractors",
    },
  ].filter((item) => item.count > 0);

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Home</h3>
      <p className="helper-text" style={{ marginBottom: 20 }}>
        Today's activity and what needs your attention.
      </p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}

      {!loading && !error && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
            <StatTile label="Visitors today" count={visitorsToday} />
            <StatTile label="Vehicle requests today" count={vehiclesToday} />
            <StatTile label="Contractors registered today" count={contractorsToday} />
          </div>

          <p className="helper-text" style={{ marginBottom: 8, fontWeight: 600, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>
            Action Required
          </p>
          {actionItems.length === 0 ? (
            <p className="helper-text" style={{ marginBottom: 20 }}>Nothing needs your attention right now.</p>
          ) : (
            <div style={{ marginBottom: 20 }}>
              {actionItems.map((item) => (
                <ActionRow key={item.label} {...item} />
              ))}
            </div>
          )}
        </>
      )}

      <p className="helper-text" style={{ marginBottom: 8, fontWeight: 600, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>
        Quick links
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {QUICK_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="btn-small" style={{ textDecoration: "none", display: "inline-flex" }}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
