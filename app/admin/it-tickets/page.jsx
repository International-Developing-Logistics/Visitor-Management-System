"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { useFacility } from "@/lib/facilityContext";

const STATUS_LABEL = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" };
const STATUS_BADGE_CLASS = { open: "requested", in_progress: "gate_pending", resolved: "checked_in", closed: "checked_out" };
const STATUSES = ["open", "in_progress", "resolved", "closed"];
const PRIORITY_LABEL = { low: "Low", normal: "Normal", urgent: "Urgent" };

function TicketRow({ ticket, onSaved }) {
  const [notes, setNotes] = useState(ticket.admin_notes || "");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const patch = async (body, setSaving) => {
    setSaving(true);
    try {
      const res = await authFetch(`/api/admin/it-tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      onSaved(data.ticket);
    } catch {
      // best-effort UI; the row just won't reflect the change
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{ticket.description}</p>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <span className={`badge priority-${ticket.priority}`}>{PRIORITY_LABEL[ticket.priority]}</span>
          <span className={`badge ${STATUS_BADGE_CLASS[ticket.status]}`}>{STATUS_LABEL[ticket.status]}</span>
        </div>
      </div>

      <p className="helper-text" style={{ marginTop: 8, marginBottom: 12 }}>
        {ticket.submitter_name} ({ticket.submitter_email}) · {formatInCompanyTimezone(ticket.created_at)}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <label htmlFor={`status-${ticket.id}`} style={{ margin: 0, fontSize: "0.85rem" }}>Status</label>
        <select
          id={`status-${ticket.id}`}
          value={ticket.status}
          disabled={savingStatus}
          onChange={(e) => patch({ status: e.target.value }, setSavingStatus)}
          style={{ width: "auto" }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      <label htmlFor={`notes-${ticket.id}`} style={{ fontSize: "0.85rem" }}>Admin notes (optional, internal only)</label>
      <textarea
        id={`notes-${ticket.id}`}
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button
        className="btn-small"
        onClick={() => patch({ admin_notes: notes }, setSavingNotes)}
        disabled={savingNotes || notes === (ticket.admin_notes || "")}
      >
        {savingNotes ? "Saving…" : "Save note"}
      </button>
    </div>
  );
}

export default function AdminITTicketsPage() {
  const { facility } = useFacility();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/it-tickets?facility=${facility}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTickets(data.tickets || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [facility]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = (updated) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 4 }}>IT Tickets</h3>
      <p className="helper-text" style={{ marginBottom: 16 }}>
        Submitted from the Staff Hub - name and email are captured so issues can be followed up on.
      </p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && tickets.length === 0 && <p className="helper-text">No tickets yet.</p>}

      {!loading &&
        tickets.map((ticket) => (
          <TicketRow key={ticket.id} ticket={ticket} onSaved={handleSaved} />
        ))}
    </div>
  );
}
