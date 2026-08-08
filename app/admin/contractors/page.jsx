"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/apiFetch";

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function EditContractorModal({ contractor, onClose, onSaved }) {
  const [values, setValues] = useState({
    full_name: contractor.full_name || "",
    email: contractor.email || "",
    resident_id: contractor.resident_id || "",
    estimated_duration: contractor.estimated_duration || "",
  });
  const [validityStart, setValidityStart] = useState(toLocalInputValue(contractor.validity_start));
  const [validityEnd, setValidityEnd] = useState(toLocalInputValue(contractor.validity_end));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/contractors/${contractor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          validity_start: validityStart || "",
          validity_end: validityEnd || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.contractor);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(22,33,31,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 460, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h3>Edit contractor</h3>

        <label>Full name</label>
        <input type="text" value={values.full_name} onChange={set("full_name")} />

        <label>Email</label>
        <input type="email" value={values.email} onChange={set("email")} />

        <label>Resident ID</label>
        <input type="text" value={values.resident_id} onChange={set("resident_id")} />

        <label>Estimated duration</label>
        <input type="text" value={values.estimated_duration} onChange={set("estimated_duration")} />

        <div className="row-2">
          <div>
            <label>Valid from</label>
            <input type="date" value={validityStart} onChange={(e) => setValidityStart(e.target.value)} />
          </div>
          <div>
            <label>Valid until</label>
            <input type="date" value={validityEnd} onChange={(e) => setValidityEnd(e.target.value)} />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 0 }} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} style={{ marginTop: 0 }} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminContractorsPage() {
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/admin/contractors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContractors(data.contractors || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id, status) => {
    setBusyId(id);
    try {
      const res = await authFetch(`/api/admin/contractors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
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
      <h3 style={{ marginBottom: 16 }}>Contractor passes</h3>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && contractors.length === 0 && <p className="helper-text">No contractors registered yet.</p>}

      {!loading && contractors.length > 0 && (
        <div className="vtable-scroll">
        <table className="vtable">
          <thead>
            <tr>
              <th>Contractor</th>
              <th>Resident ID</th>
              <th>Duration</th>
              <th>Validity</th>
              <th>Passport</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.full_name}</div>
                  <div className="helper-text" style={{ marginTop: 0 }}>{c.email}</div>
                </td>
                <td>{c.resident_id || "—"}</td>
                <td>{c.estimated_duration || "—"}</td>
                <td style={{ fontSize: "0.82rem" }}>
                  {c.validity_start ? new Date(c.validity_start).toLocaleDateString() : "—"}
                  {" – "}
                  {c.validity_end ? new Date(c.validity_end).toLocaleDateString() : "—"}
                </td>
                <td>
                  {c.passport_signed_url ? (
                    <a href={c.passport_signed_url} target="_blank" rel="noreferrer">View</a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <span className={`badge ${c.status === "active" ? "checked_in" : c.status === "inactive" ? "checked_out" : "invited"}`}>
                    {c.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="btn-small" onClick={() => setEditing(c)}>Edit</button>
                    {c.status !== "active" && (
                      <button className="btn-small" onClick={() => setStatus(c.id, "active")} disabled={busyId === c.id}>
                        {busyId === c.id ? "…" : "Activate"}
                      </button>
                    )}
                    {c.status !== "inactive" && (
                      <button className="btn-small" onClick={() => setStatus(c.id, "inactive")} disabled={busyId === c.id}>
                        {busyId === c.id ? "…" : "Deactivate"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {editing && (
        <EditContractorModal
          contractor={editing}
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
