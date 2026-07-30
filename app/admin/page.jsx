"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/apiFetch";

const TABS = [
  { key: "", label: "All" },
  { key: "checked_in", label: "Checked in" },
  { key: "pre_registered", label: "Expected" },
  { key: "checked_out", label: "Checked out" },
];

const STATUS_LABEL = {
  invited: "Invited",
  pre_registered: "Expected",
  checked_in: "Checked in",
  checked_out: "Checked out",
};

export default function AdminDashboard() {
  const [tab, setTab] = useState("");
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = tab ? `/api/admin/visitors?status=${tab}` : "/api/admin/visitors";
      const res = await authFetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVisitors(data.visitors || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const checkOut = async (id) => {
    setBusyId(id);
    try {
      const res = await authFetch("/api/admin/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
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
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}

      {!loading && visitors.length === 0 && (
        <p className="helper-text">No visitors in this view yet.</p>
      )}

      {!loading && visitors.length > 0 && (
        <table className="vtable">
          <thead>
            <tr>
              <th></th>
              <th>Visitor</th>
              <th>Host</th>
              <th>Purpose</th>
              <th>Status</th>
              <th>Arrived</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visitors.map((v) => (
              <tr key={v.id}>
                <td>
                  {v.photo_signed_url ? (
                    <img
                      src={v.photo_signed_url}
                      alt={`${v.full_name || "Visitor"} photo`}
                      style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: "var(--paper)",
                        border: "1px solid var(--line)",
                      }}
                    />
                  )}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{v.full_name || "(pending)"}</div>
                  <div className="helper-text" style={{ marginTop: 0 }}>
                    {v.company ? `${v.company} · ` : ""}{v.email}
                  </div>
                </td>
                <td>{v.hosts?.name || "—"}</td>
                <td>{v.purpose}</td>
                <td>
                  <span className={`badge ${v.status}`}>{STATUS_LABEL[v.status] || v.status}</span>
                </td>
                <td>
                  {v.checked_in_at
                    ? new Date(v.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </td>
                <td>
                  {v.status === "checked_in" && (
                    <button className="btn-small" onClick={() => checkOut(v.id)} disabled={busyId === v.id}>
                      {busyId === v.id ? "…" : "Check out"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
