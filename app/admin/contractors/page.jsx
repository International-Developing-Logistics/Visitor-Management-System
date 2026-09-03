"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/apiFetch";

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_TONE = {
  pending: "gate_pending",
  denied: "gate_denied",
  active: "checked_in",
  inactive: "checked_out",
};

function EditContractorModal({ contractor, onClose, onSaved }) {
  const [values, setValues] = useState({
    full_name: contractor.full_name || "",
    email: contractor.email || "",
    resident_id: contractor.resident_id || "",
    company: contractor.company || "",
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

        <label>Company</label>
        <input type="text" value={values.company} onChange={set("company")} />

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

function DenyContractorModal({ contractor, onClose, onDenied }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const deny = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/contractors/${contractor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "denied", denial_reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDenied(data.contractor);
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
      <div className="card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h3>Deny registration</h3>
        <p className="helper-text" style={{ marginTop: 0 }}>
          Denying <strong>{contractor.full_name}</strong>'s registration. A reason is optional and is only ever
          shown here in the admin dashboard — it's never sent to the applicant.
        </p>

        <label htmlFor="deny-reason">Reason (optional)</label>
        <textarea
          id="deny-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Documents didn't match, incomplete details…"
          style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
        />

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 0 }} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={deny} style={{ marginTop: 0 }} disabled={saving}>
            {saving ? "Denying…" : "Deny registration"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VisitLogModal({ contractor, onClose }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/admin/contractors/${contractor.id}/visits`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!cancelled) setVisits(data.visits || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractor.id]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(22,33,31,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h3>Visit log — {contractor.full_name}</h3>

        {loading && <p className="helper-text">Loading…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && visits.length === 0 && (
          <p className="helper-text">No visits logged yet.</p>
        )}

        {!loading && visits.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", color: "var(--muted)", padding: "6px 0" }}>Checked in</th>
                <th style={{ textAlign: "left", color: "var(--muted)", padding: "6px 0" }}>Checked out</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td style={{ padding: "6px 0" }}>{fmtDateTime(v.checked_in_at)}</td>
                  <td style={{ padding: "6px 0" }}>
                    {v.checked_out_at ? fmtDateTime(v.checked_out_at) : <span className="badge checked_in">On site</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 0 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentLinks({ contractor }) {
  // Older records (registered before this feature) have no document_type
  // recorded — fall back to just showing whatever passport link they have.
  if (contractor.document_type === "freezone_pass") {
    return (
      <div>
        <div className="helper-text" style={{ marginTop: 0 }}>Freezone gate pass</div>
        {contractor.freezone_pass_signed_url ? (
          <a href={contractor.freezone_pass_signed_url} target="_blank" rel="noreferrer">View</a>
        ) : (
          "—"
        )}
      </div>
    );
  }
  if (contractor.document_type === "passport_emirates_id") {
    return (
      <div>
        <div className="helper-text" style={{ marginTop: 0 }}>Passport + Emirates ID</div>
        <div style={{ display: "flex", gap: 10 }}>
          {contractor.passport_signed_url ? (
            <a href={contractor.passport_signed_url} target="_blank" rel="noreferrer">Passport</a>
          ) : (
            <span className="helper-text" style={{ marginTop: 0 }}>Passport —</span>
          )}
          {contractor.emirates_id_signed_url ? (
            <a href={contractor.emirates_id_signed_url} target="_blank" rel="noreferrer">Emirates ID</a>
          ) : (
            <span className="helper-text" style={{ marginTop: 0 }}>Emirates ID —</span>
          )}
        </div>
      </div>
    );
  }
  return contractor.passport_signed_url ? (
    <a href={contractor.passport_signed_url} target="_blank" rel="noreferrer">View</a>
  ) : (
    "—"
  );
}

export default function AdminContractorsPage() {
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [visitBusyId, setVisitBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [denying, setDenying] = useState(null);
  const [viewingLog, setViewingLog] = useState(null);

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

  const toggleVisit = async (id, action) => {
    setVisitBusyId(id);
    try {
      const res = await authFetch(`/api/admin/contractors/${id}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setVisitBusyId(null);
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
              <th>Pass ID</th>
              <th>Contractor</th>
              <th>Company</th>
              <th>Resident ID</th>
              <th>Duration</th>
              <th>Validity</th>
              <th>Documents</th>
              <th>Status</th>
              <th>Visits</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((c) => (
              <tr key={c.id}>
                <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>{c.pass_id || "—"}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.full_name}</div>
                  <div className="helper-text" style={{ marginTop: 0 }}>{c.email}</div>
                </td>
                <td>{c.company || "—"}</td>
                <td>{c.resident_id || "—"}</td>
                <td>{c.estimated_duration || "—"}</td>
                <td style={{ fontSize: "0.82rem" }}>
                  {c.validity_start ? new Date(c.validity_start).toLocaleDateString() : "—"}
                  {" – "}
                  {c.validity_end ? new Date(c.validity_end).toLocaleDateString() : "—"}
                </td>
                <td><DocumentLinks contractor={c} /></td>
                <td>
                  <span className={`badge ${STATUS_TONE[c.status] || "invited"}`}>{c.status}</span>
                  {c.status === "denied" && c.denial_reason && (
                    <div className="helper-text" style={{ marginTop: 4, maxWidth: 180 }}>{c.denial_reason}</div>
                  )}
                </td>
                <td>
                  <span className={`badge ${c.currently_checked_in ? "checked_in" : "checked_out"}`}>
                    {c.currently_checked_in ? "On site" : "Off site"}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {c.status === "active" ? (
                      c.currently_checked_in ? (
                        <button
                          className="btn-small"
                          onClick={() => toggleVisit(c.id, "checkout")}
                          disabled={visitBusyId === c.id}
                        >
                          {visitBusyId === c.id ? "…" : "Check out"}
                        </button>
                      ) : (
                        <button
                          className="btn-small"
                          onClick={() => toggleVisit(c.id, "checkin")}
                          disabled={visitBusyId === c.id}
                        >
                          {visitBusyId === c.id ? "…" : "Check in"}
                        </button>
                      )
                    ) : (
                      <span className="helper-text" style={{ marginTop: 0 }}>Pass must be active</span>
                    )}
                    <button className="btn-small" onClick={() => setViewingLog(c)}>Log</button>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="btn-small" onClick={() => setEditing(c)}>Edit</button>
                    {c.status === "pending" ? (
                      <>
                        <button className="btn-small" onClick={() => setStatus(c.id, "active")} disabled={busyId === c.id}>
                          {busyId === c.id ? "…" : "Approve"}
                        </button>
                        <button className="btn-small" onClick={() => setDenying(c)} disabled={busyId === c.id}>
                          Deny
                        </button>
                      </>
                    ) : (
                      <>
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
                      </>
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

      {denying && (
        <DenyContractorModal
          contractor={denying}
          onClose={() => setDenying(null)}
          onDenied={() => {
            setDenying(null);
            load();
          }}
        />
      )}

      {viewingLog && (
        <VisitLogModal contractor={viewingLog} onClose={() => setViewingLog(null)} />
      )}
    </div>
  );
}
