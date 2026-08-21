"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatTimeInCompanyTimezone } from "@/lib/timezone";
import { FACILITIES, DEFAULT_FACILITY } from "@/lib/facilities";

const POLL_MS = 5000;

export default function AdminGuardLogsPage() {
  const [facility, setFacility] = useState(DEFAULT_FACILITY);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`/api/guard-logs?facility=${facility}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLogs(data.logs || []);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [facility]);

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const checkOut = async (id) => {
    setBusyId(id);
    try {
      const res = await authFetch(`/api/guard-logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-card">
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <span className="helper-text" style={{ marginTop: 0 }}>Facility:</span>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.values(FACILITIES).map((f) => (
            <button
              key={f.key}
              className={`tab ${facility === f.key ? "active" : ""}`}
              onClick={() => setFacility(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <h3 style={{ marginBottom: 4 }}>Guard vehicle log</h3>
      <p className="helper-text" style={{ marginBottom: 16 }}>Refresh the page if the information has not updated.</p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && logs.length === 0 && <p className="helper-text">No entries logged yet.</p>}

      {!loading && logs.length > 0 && (
        <div className="vtable-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th></th>
                <th>Visitor</th>
                <th>Car</th>
                <th>Logged by</th>
                <th>In</th>
                <th>Out</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.vehicle_plate_photo_signed_url ? (
                      <a href={g.vehicle_plate_photo_signed_url} target="_blank" rel="noreferrer">
                        <img
                          src={g.vehicle_plate_photo_signed_url}
                          alt="Plate"
                          style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }}
                        />
                      </a>
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--line)" }} />
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{g.visitor_name}</div>
                    <div className="helper-text" style={{ marginTop: 0 }}>
                      {[g.company, g.phone].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td>{g.car_type || "—"}</td>
                  <td style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{g.logged_by_email || "—"}</td>
                  <td>{formatTimeInCompanyTimezone(g.checked_in_at)}</td>
                  <td>{g.checked_out_at ? formatTimeInCompanyTimezone(g.checked_out_at) : "—"}</td>
                  <td>
                    {!g.checked_out_at && (
                      <button className="btn-small" onClick={() => checkOut(g.id)} disabled={busyId === g.id}>
                        {busyId === g.id ? "…" : "Check out"}
                      </button>
                    )}
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
