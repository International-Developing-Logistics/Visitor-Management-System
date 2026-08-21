"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { FACILITIES, DEFAULT_FACILITY } from "@/lib/facilities";

const STATUS_LABEL = { pending: "Pending", approved: "Approved", denied: "Denied" };
const STATUS_BADGE_CLASS = { pending: "invited", approved: "checked_in", denied: "gate_denied" };

function equipmentSummary(r) {
  const parts = [];
  if (r.equipment_items?.length) parts.push(r.equipment_items.join(", "));
  else if (r.equipment) parts.push(r.equipment);
  if (r.external_rental_request) parts.push(`Rental: ${r.external_rental_request}`);
  return parts.length ? parts.join(" · ") : "—";
}

export default function AdminEquipmentRequestsPage() {
  const [facility, setFacility] = useState(DEFAULT_FACILITY);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/equipment-requests?facility=${facility}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests(data.requests || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [facility]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id, action) => {
    setBusyId(id);
    try {
      const res = await authFetch(`/api/admin/equipment-requests/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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

      <h3 style={{ marginBottom: 16 }}>Equipment requests</h3>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && requests.length === 0 && <p className="helper-text">No equipment requests yet.</p>}

      {!loading && requests.length > 0 && (
        <div className="vtable-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Equipment</th>
                <th>Location</th>
                <th>Estimated time</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>In use?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.employee_name}</td>
                  <td>{equipmentSummary(r)}</td>
                  <td>{r.location || "—"}</td>
                  <td>{r.estimated_time || "—"}</td>
                  <td style={{ fontSize: "0.82rem" }}>{formatInCompanyTimezone(r.created_at)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td>
                    {r.status === "approved" ? (
                      r.returned_at ? (
                        <span className="helper-text" style={{ marginTop: 0 }}>Returned</span>
                      ) : (
                        <span className="badge gate_pending">In use</span>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {r.status === "pending" ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-small" onClick={() => decide(r.id, "approve")} disabled={busyId === r.id}>
                          {busyId === r.id ? "…" : "Approve"}
                        </button>
                        <button className="btn-small" onClick={() => decide(r.id, "deny")} disabled={busyId === r.id}>
                          Deny
                        </button>
                      </div>
                    ) : r.status === "approved" && !r.returned_at ? (
                      <button className="btn-small" onClick={() => decide(r.id, "mark_returned")} disabled={busyId === r.id}>
                        {busyId === r.id ? "…" : "Mark returned"}
                      </button>
                    ) : (
                      <button className="btn-small" onClick={() => decide(r.id, "revert")} disabled={busyId === r.id}>
                        {busyId === r.id ? "…" : "Undo"}
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
