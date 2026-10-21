"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";

const STATUS_LABEL = {
  invited: "Invited",
  pre_registered: "Pre-registered",
  requested: "Awaiting approval",
  gate_pending: "At gate",
  gate_approved: "Approved",
  checked_in: "On site",
  checked_out: "Checked out",
  gate_denied: "Denied",
  did_not_visit: "Did not visit",
};

// "Maintain a complete visit history for each returning visitor" - every
// past visit already exists as its own row in `visitors` (nothing is
// collapsed or overwritten when the same phone number checks in again),
// so this is just a read-only list of every row sharing one phone number,
// across every status and facility, newest first.
export default function VisitorHistoryModal({ phone, fullName, onClose }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await authFetch(`/api/admin/visitors?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!cancelled) setVisits(data.visitors || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(22,33,31,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Visit history{fullName ? ` — ${fullName}` : ""}</h3>
        <p className="helper-text" style={{ marginTop: 0 }}>Every visit on record for {phone}.</p>

        {loading && <p className="helper-text">Loading…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && visits.length === 0 && <p className="helper-text">No visits found.</p>}

        {!loading && visits.length > 0 && (
          <table className="vtable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Host</th>
                <th>Facility</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontSize: "0.85rem" }}>{formatInCompanyTimezone(v.checked_in_at || v.created_at)}</td>
                  <td>
                    <span className={`badge ${v.status}`}>{STATUS_LABEL[v.status] || v.status}</span>
                  </td>
                  <td>{v.hosts?.name || "-"}</td>
                  <td style={{ textTransform: "capitalize" }}>{v.facility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 0 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
