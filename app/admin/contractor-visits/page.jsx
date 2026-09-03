"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone, utcIsoToCompanyLocalInputValue, companyLocalToUtcIso } from "@/lib/timezone";

function EditTimesModal({ visit, onClose, onSaved }) {
  const [checkedInAt, setCheckedInAt] = useState(utcIsoToCompanyLocalInputValue(visit.checked_in_at));
  const [checkedOutAt, setCheckedOutAt] = useState(utcIsoToCompanyLocalInputValue(visit.checked_out_at));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/contractor-visits/${visit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checked_in_at: companyLocalToUtcIso(checkedInAt),
          checked_out_at: checkedOutAt ? companyLocalToUtcIso(checkedOutAt) : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.visit);
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
        <h3>Correct times - {visit.contractor?.full_name || "Contractor"}</h3>

        <label htmlFor="ev-checkin">Check-in time</label>
        <input id="ev-checkin" type="datetime-local" value={checkedInAt} onChange={(e) => setCheckedInAt(e.target.value)} />

        <label htmlFor="ev-checkout">Check-out time</label>
        <input id="ev-checkout" type="datetime-local" value={checkedOutAt} onChange={(e) => setCheckedOutAt(e.target.value)} />
        <p className="helper-text" style={{ marginTop: 6 }}>
          Leave check-out time blank to mark this contractor as still on site.
        </p>

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

function contractorLabel(c) {
  return `${c.full_name} - ${c.company || "-"} (${c.pass_id || "no pass id"})`;
}

function matchesQuery(c, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    c.full_name.toLowerCase().includes(q) ||
    (c.pass_id || "").toLowerCase().includes(q)
  );
}

// A searchable stand-in for a <select> — type a contractor's name or pass
// ID to filter the list instead of scrolling a long dropdown. Only an
// actual pick from the list counts as a selection (onSelect("") whenever
// the typed text no longer matches it), so the Check in button still only
// enables once a real contractor is chosen.
function ContractorPicker({ contractors, selectedId, onSelect, disabled }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const selected = contractors.find((c) => c.id === selectedId);
    setQuery(selected ? contractorLabel(selected) : "");
  }, [selectedId, contractors]);

  const matches = contractors.filter((c) => matchesQuery(c, query)).slice(0, 30);

  return (
    <div style={{ position: "relative", minWidth: 280 }}>
      <input
        type="text"
        value={query}
        placeholder={
          disabled && contractors.length === 0
            ? "No active contractors available to check in"
            : "Type a name or pass ID…"
        }
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selectedId) onSelect("");
          setOpen(true);
        }}
        style={{ width: "100%" }}
      />
      {open && matches.length > 0 && (
        <div
          className="card"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
            padding: 6, maxHeight: 240, overflowY: "auto",
          }}
        >
          {matches.map((c) => (
            <div
              key={c.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(c.id);
                setQuery(contractorLabel(c));
                setOpen(false);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                cursor: "pointer",
                background: c.id === selectedId ? "var(--accent-soft)" : "transparent",
              }}
            >
              <div style={{ fontWeight: 600 }}>{c.full_name}</div>
              <div className="helper-text" style={{ marginTop: 0 }}>
                {c.company || "—"} · {c.pass_id || "no pass id"}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && query.trim() && matches.length === 0 && (
        <div className="card" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, padding: 10 }}>
          <span className="helper-text" style={{ marginTop: 0 }}>No match found.</span>
        </div>
      )}
    </div>
  );
}

export default function AdminContractorVisitsPage() {
  const [contractors, setContractors] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedContractorId, setSelectedContractorId] = useState("");
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkoutBusyId, setCheckoutBusyId] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [contractorsRes, visitsRes] = await Promise.all([
        authFetch("/api/admin/contractors"),
        authFetch("/api/admin/contractor-visits"),
      ]);
      const contractorsData = await contractorsRes.json();
      const visitsData = await visitsRes.json();
      if (!contractorsRes.ok) throw new Error(contractorsData.error);
      if (!visitsRes.ok) throw new Error(visitsData.error);
      setContractors(contractorsData.contractors || []);
      setVisits(visitsData.visits || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openContractorIds = new Set(visits.filter((v) => !v.checked_out_at).map((v) => v.contractor_id));

  const eligibleToCheckIn = contractors.filter(
    (c) => c.status === "active" && !openContractorIds.has(c.id)
  );

  useEffect(() => {
    // Keep the selector pointed at a still-eligible contractor after a reload.
    if (selectedContractorId && !eligibleToCheckIn.some((c) => c.id === selectedContractorId)) {
      setSelectedContractorId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractors, visits]);

  const checkIn = async () => {
    if (!selectedContractorId) return;
    setCheckinBusy(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/contractors/${selectedContractorId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSelectedContractorId("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCheckinBusy(false);
    }
  };

  const checkOut = async (contractorId) => {
    setCheckoutBusyId(contractorId);
    setError("");
    try {
      const res = await authFetch(`/api/admin/contractors/${contractorId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCheckoutBusyId(null);
    }
  };

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Contractor check in / out</h3>
      <p className="helper-text" style={{ marginBottom: 16 }}>
        Log every time a contractor arrives or leaves. 
      </p>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 20 }}>
        <ContractorPicker
          contractors={eligibleToCheckIn}
          selectedId={selectedContractorId}
          onSelect={setSelectedContractorId}
          disabled={loading || eligibleToCheckIn.length === 0}
        />
        <button className="btn-small" onClick={checkIn} disabled={!selectedContractorId || checkinBusy}>
          {checkinBusy ? "Checking in…" : "Check in"}
        </button>
      </div>

      {loading && <p className="helper-text">Loading…</p>}
      {!loading && visits.length === 0 && <p className="helper-text">No visits logged yet.</p>}

      {!loading && visits.length > 0 && (
        <div className="vtable-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Company</th>
                <th>Pass ID</th>
                <th>Checked in</th>
                <th>Checked out</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.contractor?.full_name || "—"}</td>
                  <td>{v.contractor?.company || "—"}</td>
                  <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>{v.contractor?.pass_id || "—"}</td>
                  <td style={{ fontSize: "0.8rem" }}>{formatInCompanyTimezone(v.checked_in_at)}</td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {v.checked_out_at ? (
                      formatInCompanyTimezone(v.checked_out_at)
                    ) : (
                      <span className="badge checked_in">On site</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {!v.checked_out_at && (
                        <button
                          className="btn-small"
                          onClick={() => checkOut(v.contractor_id)}
                          disabled={checkoutBusyId === v.contractor_id}
                        >
                          {checkoutBusyId === v.contractor_id ? "…" : "Check out"}
                        </button>
                      )}
                      <button className="btn-small" onClick={() => setEditing(v)}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditTimesModal
          visit={editing}
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
