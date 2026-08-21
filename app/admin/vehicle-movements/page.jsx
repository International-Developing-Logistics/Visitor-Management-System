"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { FACILITIES, DEFAULT_FACILITY } from "@/lib/facilities";
import { formatInCompanyTimezone, utcIsoToCompanyLocalInputValue, companyLocalToUtcIso } from "@/lib/timezone";

function durationOutside(checkedOutAt, checkedInAt) {
  const end = checkedInAt ? new Date(checkedInAt) : new Date();
  const ms = end - new Date(checkedOutAt);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function EditTimesModal({ movement, onClose, onSaved }) {
  const [checkedOutAt, setCheckedOutAt] = useState(utcIsoToCompanyLocalInputValue(movement.checked_out_at));
  const [checkedInAt, setCheckedInAt] = useState(utcIsoToCompanyLocalInputValue(movement.checked_in_at));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/vehicle-movements/${movement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checked_out_at: companyLocalToUtcIso(checkedOutAt),
          checked_in_at: checkedInAt ? companyLocalToUtcIso(checkedInAt) : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.movement);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(22,33,31,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h3>Correct times — {movement.vehicle} ({movement.license_plate})</h3>

        <label htmlFor="em-checkout">Check-out time</label>
        <input id="em-checkout" type="datetime-local" value={checkedOutAt} onChange={(e) => setCheckedOutAt(e.target.value)} />

        <label htmlFor="em-checkin">Check-in time</label>
        <input id="em-checkin" type="datetime-local" value={checkedInAt} onChange={(e) => setCheckedInAt(e.target.value)} />

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 0 }} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} style={{ marginTop: 0 }} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminVehicleMovementsPage() {
  const [facility, setFacility] = useState(DEFAULT_FACILITY);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/vehicle-movements?facility=${facility}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMovements(data.movements || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [facility]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="admin-card">
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <span className="helper-text" style={{ marginTop: 0 }}>Facility:</span>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.values(FACILITIES).map((f) => (
            <button key={f.key} className={`tab ${facility === f.key ? "active" : ""}`} onClick={() => setFacility(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <h3 style={{ marginBottom: 4 }}>Vehicle movement history</h3>
      <p className="helper-text" style={{ marginBottom: 16 }}>
        Use the Edit button to correct any mistaken entries.
      </p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && movements.length === 0 && <p className="helper-text">No movements recorded yet.</p>}

      {!loading && movements.length > 0 && (
        <div className="vtable-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Plate</th>
                <th>Driver</th>
                <th>Out</th>
                <th>In</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Photos</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.vehicle}</td>
                  <td style={{ fontWeight: 600 }}>{m.license_plate}</td>
                  <td>{m.driver_name}</td>
                  <td style={{ fontSize: "0.8rem" }}>{formatInCompanyTimezone(m.checked_out_at)}</td>
                  <td style={{ fontSize: "0.8rem" }}>{m.checked_in_at ? formatInCompanyTimezone(m.checked_in_at) : "—"}</td>
                  <td>{durationOutside(m.checked_out_at, m.checked_in_at)}</td>
                  <td>
                    <span className={`badge ${m.checked_in_at ? "checked_out" : "gate_pending"}`}>
                      {m.checked_in_at ? "Available" : "Out"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      {m.checkout_photo_signed_url && <a href={m.checkout_photo_signed_url} target="_blank" rel="noreferrer">Out</a>}
                      {m.checkin_photo_signed_url && <a href={m.checkin_photo_signed_url} target="_blank" rel="noreferrer">In</a>}
                    </div>
                  </td>
                  <td style={{ fontSize: "0.78rem", maxWidth: 160 }}>
                    {[m.checkout_condition_notes, m.checkin_condition_notes, m.incident_notes].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td>
                    <button className="btn-small" onClick={() => setEditing(m)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditTimesModal
          movement={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
