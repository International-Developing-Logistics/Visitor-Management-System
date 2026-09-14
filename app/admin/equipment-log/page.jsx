"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { useFacility } from "@/lib/facilityContext";

// Read-only - there's no decide/approve step for this feature (unlike the
// old equipment_requests workflow it replaces). Entries are created only
// by staff scanning a physical QR code; this page and the guard
// dashboard's matching tab both just display what's already been logged,
// via the same GET /api/guard/equipment-log endpoint (requireAdminOrGuard
// covers both roles, so one route serves both views).
const TABS = [
  { key: "active", label: "Currently Out" },
  { key: "history", label: "History" },
];

function durationOut(checkedOutAt, checkedInAt) {
  const end = checkedInAt ? new Date(checkedInAt) : new Date();
  const ms = end - new Date(checkedOutAt);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export default function AdminEquipmentLogPage() {
  const { facility } = useFacility();
  const [tab, setTab] = useState("active");
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/guard/equipment-log?facility=${facility}&view=${tab}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMovements(data.movements || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [facility, tab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Equipment Log</h3>
      <p className="helper-text" style={{ marginBottom: 16 }}>
        Checkout/return entries logged by scanning each unit's QR code. Read-only - see "Print QR Labels" to manage the unit list.
      </p>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && movements.length === 0 && (
        <p className="helper-text">{tab === "active" ? "No equipment currently checked out." : "No log entries yet."}</p>
      )}

      {!loading && movements.length > 0 && (
        <div className="vtable-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Type</th>
                <th>User</th>
                <th>Out</th>
                <th>In</th>
                <th>Duration</th>
                <th>Photos</th>
                <th>Damage</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.unit_name}</td>
                  <td>{m.equipment_type}</td>
                  <td>{m.user_name}</td>
                  <td style={{ fontSize: "0.8rem" }}>{formatInCompanyTimezone(m.checked_out_at)}</td>
                  <td style={{ fontSize: "0.8rem" }}>{m.checked_in_at ? formatInCompanyTimezone(m.checked_in_at) : "Still out"}</td>
                  <td>{durationOut(m.checked_out_at, m.checked_in_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      {m.hour_meter_photo_signed_url && (
                        <a href={m.hour_meter_photo_signed_url} target="_blank" rel="noreferrer">Hours</a>
                      )}
                      {m.damage_photo_signed_url && (
                        <a href={m.damage_photo_signed_url} target="_blank" rel="noreferrer">Damage</a>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: "0.78rem", maxWidth: 160 }}>
                    {m.damaged ? (m.damage_notes || "Reported, no note") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
