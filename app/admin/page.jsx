"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/apiFetch";
import EditVisitorModal from "@/components/EditVisitorModal";
import HyperlinkCopier from "@/components/HyperlinkCopier";
import { formatInCompanyTimezone, formatTimeInCompanyTimezone } from "@/lib/timezone";
import { FACILITIES, DEFAULT_FACILITY } from "@/lib/facilities";

const TABS = [
  { key: "", label: "All" },
  { key: "requested", label: "Requests" },
  { key: "gate_pending,gate_approved,gate_denied", label: "Gate" },
  { key: "checked_in", label: "Checked in" },
  { key: "pre_registered", label: "Expected" },
  { key: "checked_out", label: "Checked out" },
];

const STATUS_LABEL = {
  requested: "Requested",
  invited: "Invited",
  pre_registered: "Expected",
  checked_in: "Checked in",
  checked_out: "Checked out",
  gate_pending: "Awaiting approval",
  gate_approved: "Approved",
  gate_denied: "Denied",
};

function fmtTime(ts) {
  return ts ? formatTimeInCompanyTimezone(ts) : "—";
}

function fmtMeetingTime(v) {
  if (v.selected_time_slot) return formatInCompanyTimezone(v.selected_time_slot);
  if (v.proposed_alternative_time) return `Proposed: ${formatInCompanyTimezone(v.proposed_alternative_time)}`;
  if (v.proposed_time_slots && v.proposed_time_slots.length > 0) return "Awaiting choice";
  return "—";
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminDashboard() {
  const [facility, setFacility] = useState(DEFAULT_FACILITY);
  const [tab, setTab] = useState("");
  const [visitors, setVisitors] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [editingVisitor, setEditingVisitor] = useState(null);
  const [exportMonth, setExportMonth] = useState(currentMonth());
  const [exporting, setExporting] = useState(false);
  const [approvedLink, setApprovedLink] = useState(null); // { guestName, checkinUrl, emailSent }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ facility });
      if (tab) params.set("status", tab);
      const res = await authFetch(`/api/admin/visitors?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVisitors(data.visitors || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab, facility]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    authFetch("/api/admin/hosts")
      .then((r) => r.json())
      .then((d) => setHosts(d.hosts || []))
      .catch(() => setHosts([]));
  }, []);

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

  const manualCheckIn = async (id) => {
    setBusyId(id);
    try {
      const res = await authFetch("/api/admin/checkin", {
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

  const approveRequest = async (v, sendEmail) => {
    setBusyId(v.id);
    setError("");
    try {
      const res = await authFetch(`/api/admin/requests/${v.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send_email: sendEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApprovedLink({ guestName: v.full_name || v.email, checkinUrl: data.checkinUrl, emailSent: data.emailSent });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const decideGate = async (id, action) => {
    setBusyId(id);
    setError("");
    try {
      const res = await authFetch(`/api/admin/gate/${id}/decide`, {
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

  const runExport = async () => {
    setExporting(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/export?month=${exportMonth}&facility=${facility}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visitor-log-${facility}-${exportMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
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

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 20,
          paddingBottom: 20,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <label style={{ margin: 0 }}>Export month</label>
        <input
          type="month"
          value={exportMonth}
          onChange={(e) => setExportMonth(e.target.value)}
          style={{ width: "auto", padding: "8px 12px" }}
        />
        <button className="btn-small" onClick={runExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {approvedLink && (
        <div
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent)",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <strong>Approved: {approvedLink.guestName}</strong>
              <p className="helper-text" style={{ marginTop: 4 }}>
                {approvedLink.emailSent
                  ? "Emailed to the guest. Link also copyable below."
                  : "Share this link with the guest directly:"}
              </p>
            </div>
            <button
              onClick={() => setApprovedLink(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
            >
              ✕
            </button>
          </div>
          <div style={{ marginTop: 8 }}>
            <HyperlinkCopier url={approvedLink.checkinUrl} defaultText="Click here to complete your pre-registration" />
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}

      {!loading && visitors.length === 0 && (
        <p className="helper-text">No visitors in this view yet.</p>
      )}

      {!loading && visitors.length > 0 && (
        <div className="vtable-scroll">
        <table className="vtable">
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Host</th>
              <th>Purpose</th>
              <th>Group</th>
              <th>Meeting Time</th>
              <th>Status</th>
              <th>Arrived</th>
              <th>Left</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visitors.map((v) => (
              <tr key={v.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{v.full_name || "(pending)"}</div>
                  <div className="helper-text" style={{ marginTop: 0 }}>
                    {[v.company, v.email || "no email", v.phone].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td>{v.hosts?.name || "—"}</td>
                <td>{v.purpose}</td>
                <td>
                  {v.additional_visitor_count > 0 ? (
                    <span title={v.additional_visitor_names || ""}>+{v.additional_visitor_count}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{fmtMeetingTime(v)}</td>
                <td>
                  <span className={`badge ${v.status}`}>{STATUS_LABEL[v.status] || v.status}</span>
                </td>
                <td>{fmtTime(v.checked_in_at)}</td>
                <td>{fmtTime(v.checked_out_at)}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {v.status === "requested" ? (
                      <>
                        <button
                          className="btn-small"
                          onClick={() => approveRequest(v, true)}
                          disabled={busyId === v.id}
                        >
                          {busyId === v.id ? "…" : "Approve & email"}
                        </button>
                        <button
                          className="btn-small"
                          onClick={() => approveRequest(v, false)}
                          disabled={busyId === v.id}
                        >
                          Approve, get link
                        </button>
                      </>
                    ) : v.status === "gate_pending" ? (
                      <>
                        <button
                          className="btn-small"
                          onClick={() => decideGate(v.id, "approve")}
                          disabled={busyId === v.id}
                        >
                          {busyId === v.id ? "…" : "Approve"}
                        </button>
                        <button
                          className="btn-small"
                          onClick={() => decideGate(v.id, "deny")}
                          disabled={busyId === v.id}
                        >
                          Deny
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-small" onClick={() => setEditingVisitor(v)}>
                          Edit
                        </button>
                        {(v.status === "pre_registered" || v.status === "gate_approved") && (
                          <button
                            className="btn-small"
                            onClick={() => manualCheckIn(v.id)}
                            disabled={busyId === v.id}
                          >
                            {busyId === v.id ? "…" : "Check in"}
                          </button>
                        )}
                        {v.status === "checked_in" && (
                          <button className="btn-small" onClick={() => checkOut(v.id)} disabled={busyId === v.id}>
                            {busyId === v.id ? "…" : "Check out"}
                          </button>
                        )}
                        {(v.status === "gate_approved" || v.status === "gate_denied") && (
                          <button className="btn-small" onClick={() => decideGate(v.id, "revert")} disabled={busyId === v.id}>
                            {busyId === v.id ? "…" : "Undo"}
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

      {editingVisitor && (
        <EditVisitorModal
          visitor={editingVisitor}
          hosts={hosts}
          onClose={() => setEditingVisitor(null)}
          onSaved={() => {
            setEditingVisitor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
