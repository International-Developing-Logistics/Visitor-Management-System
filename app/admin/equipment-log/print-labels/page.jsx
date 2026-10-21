"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { authFetch } from "@/lib/apiFetch";
import { FACILITIES } from "@/lib/facilities";

// Equipment units are stored in the equipment_units table (see
// supabase/migration_equipment_units.sql) and managed right here instead
// of in lib/equipmentUnits.js - add a unit below and it's immediately
// live for checkout/check-in and ready to print a label for. Retiring a
// unit (rather than deleting it) keeps its printed QR code resolving to a
// clear "no longer in service" message instead of a 404, and keeps its
// past equipment_movements history intact.
export default function PrintEquipmentLabelsPage() {
  const [units, setUnits] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", type: "", facility: "harmony" });
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/admin/equipment-units");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUnits(data.units || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Build a QR label for every active unit whenever the list changes.
  useEffect(() => {
    const active = units.filter((u) => u.active);
    if (active.length === 0) {
      setLabels([]);
      return;
    }
    const origin = window.location.origin;
    Promise.all(
      active.map(async (u) => {
        const url = `${origin}/equipment-log/${u.id}`;
        const dataUrl = await QRCode.toDataURL(url, { width: 260, margin: 1 });
        return { ...u, url, dataUrl };
      })
    )
      .then(setLabels)
      .catch((e) => setError(e.message));
  }, [units]);

  const addUnit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await authFetch("/api/admin/equipment-units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ name: "", type: "", facility: form.facility });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (unit) => {
    setBusyId(unit.id);
    setError("");
    try {
      const res = await authFetch(`/api/admin/equipment-units/${unit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !unit.active }),
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
      <style>{`
        @media print {
          .app-sidebar, .app-header, .no-print { display: none !important; }
          .app-main, .app-content { padding: 0 !important; margin: 0 !important; }
          .label-grid { gap: 0 !important; }
        }
        .label-card {
          border: 1px dashed #999;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          break-inside: avoid;
        }
      `}</style>

      <h3 style={{ marginBottom: 4 }}>Equipment & QR Labels</h3>
      <p className="helper-text no-print" style={{ marginBottom: 16 }}>
        Add or retire equipment here - it's live for checkout immediately. A new unit gets its own printable label below.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="admin-form-inline no-print" style={{ marginBottom: 20 }}>
        <div>
          <label>Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Pallet Jack #2"
          />
        </div>
        <div>
          <label>Type</label>
          <input
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            placeholder="e.g. Pallet Jack"
          />
        </div>
        <div>
          <label>Facility</label>
          <select value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })}>
            {Object.values(FACILITIES).map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn-small"
          onClick={addUnit}
          disabled={submitting || !form.name.trim() || !form.type.trim()}
          style={{ height: 42 }}
        >
          {submitting ? "Adding…" : "+ Add Equipment"}
        </button>
      </div>

      {loading && <p className="helper-text">Loading…</p>}

      {!loading && units.length === 0 && <p className="helper-text">No equipment yet - add your first unit above.</p>}

      {!loading && units.length > 0 && (
        <div className="vtable-scroll no-print" style={{ marginBottom: 28 }}>
          <table className="vtable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Facility</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.type}</td>
                  <td>{FACILITIES[u.facility]?.label || u.facility}</td>
                  <td>
                    <span className={`badge ${u.active ? "checked_in" : "gate_denied"}`}>
                      {u.active ? "Active" : "Retired"}
                    </span>
                  </td>
                  <td>
                    <button className="btn-small" onClick={() => toggleActive(u)} disabled={busyId === u.id}>
                      {busyId === u.id ? "…" : u.active ? "Retire" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginBottom: 4 }}>Print QR Labels</h3>
      <p className="helper-text no-print" style={{ marginBottom: 16 }}>
        One label per active unit. Print, cut along the border, and stick one on each physical unit.
      </p>

      <button className="btn-small no-print" style={{ marginBottom: 20 }} onClick={() => window.print()}>
        Print
      </button>

      <div
        className="label-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}
      >
        {labels.map((l) => (
          <div key={l.id} className="label-card">
            <img src={l.dataUrl} alt={l.name} style={{ width: "100%", maxWidth: 180 }} />
            <div style={{ fontWeight: 700, marginTop: 6 }}>{l.name}</div>
            <div className="helper-text" style={{ marginTop: 0, fontSize: "0.72rem", wordBreak: "break-all" }}>
              {l.url}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
