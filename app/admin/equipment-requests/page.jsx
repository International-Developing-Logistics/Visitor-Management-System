"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { useFacility } from "@/lib/facilityContext";

// Stage = status, except "approved" splits into "approved" (still out) and
// "completed" (returned) — matches the Pending/Approved/Denied/Completed
// tab shape from the IA spec without changing the DB status values.
function stageOf(r) {
  if (r.status === "approved") return r.returned_at ? "completed" : "approved";
  return r.status;
}

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "denied", label: "Denied" },
  { key: "completed", label: "Completed" },
];

const STATUS_LABEL = { pending: "Pending", approved: "Approved", denied: "Denied", completed: "Returned" };
const STATUS_BADGE_CLASS = { pending: "invited", approved: "gate_pending", denied: "gate_denied", completed: "checked_out" };

function equipmentSummary(r) {
  const parts = [];
  if (r.equipment_items?.length) parts.push(r.equipment_items.join(", "));
  else if (r.equipment) parts.push(r.equipment);
  if (r.external_rental_request) parts.push(`Rental: ${r.external_rental_request}`);
  return parts.length ? parts.join(" · ") : "—";
}

export default function AdminEquipmentRequestsPage() {
  const { facility } = useFacility();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  // Reads ?tab= on first render only (e.g. an Action Required link from
  // Home) — see the same note in app/admin/visitors/page.jsx.
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "pending";
    const t = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((x) => x.key === t) ? t : "pending";
  });
  const [search, setSearch] = useState("");

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

  const q = search.trim().toLowerCase();
  const filtered = requests
    .filter((r) => stageOf(r) === tab)
    .filter((r) => !q || [r.employee_name, r.location, equipmentSummary(r)].filter(Boolean).some((s) => s.toLowerCase().includes(q)));

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Equipment Requests</h3>
      <p className="helper-text" style={{ marginBottom: 16 }}>Requests for shared equipment, from ask to return.</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search employee, equipment, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 220 }}
        />
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <p className="helper-text">
          {q ? "No requests match your search." : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} requests.`}
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="vtable-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Equipment</th>
                <th>Location</th>
                <th>Needed</th>
                <th>Submitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.employee_name}</td>
                  <td>{equipmentSummary(r)}</td>
                  <td>{r.location || "—"}</td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {r.needed_from
                      ? `${formatInCompanyTimezone(r.needed_from)} → ${formatInCompanyTimezone(r.needed_until)}`
                      : r.estimated_time || "—"}
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>{formatInCompanyTimezone(r.created_at)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE_CLASS[stageOf(r)]}`}>{STATUS_LABEL[stageOf(r)]}</span>
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
