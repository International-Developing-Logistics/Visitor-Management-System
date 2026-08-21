"use client";

import { useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { PURPOSE_OPTIONS } from "@/lib/purposeOptions";
import {
  companyLocalToUtcIso,
  utcIsoToCompanyLocalInputValue,
  COMPANY_TIMEZONE_LABEL,
} from "@/lib/timezone";

export default function EditVisitorModal({ visitor, hosts, onClose, onSaved }) {
  const [values, setValues] = useState({
    full_name: visitor.full_name || "",
    email: visitor.email || "",
    phone: visitor.phone || "",
    company: visitor.company || "",
    purpose: visitor.purpose || "",
    host_id: visitor.host_id || "",
    notes: visitor.notes || "",
    additional_visitor_count: String(visitor.additional_visitor_count || 0),
    additional_visitor_names: visitor.additional_visitor_names || "",
  });
  const [checkedOutAt, setCheckedOutAt] = useState(utcIsoToCompanyLocalInputValue(visitor.checked_out_at));
  const [meetingTime, setMeetingTime] = useState(
    utcIsoToCompanyLocalInputValue(visitor.selected_time_slot || visitor.proposed_alternative_time)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/visitors/${visitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          // Empty string clears the field; a value converts Dubai wall-clock
          // time (what the input represents) back to a real UTC timestamp.
          checked_out_at: checkedOutAt ? companyLocalToUtcIso(checkedOutAt) : "",
          selected_time_slot: meetingTime ? companyLocalToUtcIso(meetingTime) : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.visitor);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

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
        style={{ maxWidth: 480, maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Edit visitor</h3>

        <label>Full name</label>
        <input type="text" value={values.full_name} onChange={set("full_name")} />

        <div className="row-2">
          <div>
            <label>Email</label>
            <input type="email" value={values.email} onChange={set("email")} />
          </div>
          <div>
            <label>Phone</label>
            <input type="tel" value={values.phone} onChange={set("phone")} />
          </div>
        </div>

        <label>Company</label>
        <input type="text" value={values.company} onChange={set("company")} />

        <label>Purpose of visit</label>
        <select value={values.purpose} onChange={set("purpose")}>
          <option value="">Select…</option>
          {PURPOSE_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
          {!PURPOSE_OPTIONS.includes(values.purpose) && values.purpose && (
            <option value={values.purpose}>{values.purpose}</option>
          )}
        </select>

        <label>Host</label>
        <select value={values.host_id} onChange={set("host_id")}>
          <option value="">Select a host…</option>
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>

        <label>Additional visitors</label>
        <input
          type="text"
          inputMode="numeric"
          value={values.additional_visitor_count}
          onChange={set("additional_visitor_count")}
        />

        <label>Additional visitor names</label>
        <textarea rows={2} value={values.additional_visitor_names} onChange={set("additional_visitor_names")} />

        <label>Notes</label>
        <textarea rows={2} value={values.notes} onChange={set("notes")} />

        <label>Meeting time ({COMPANY_TIMEZONE_LABEL})</label>
        <input
          type="datetime-local"
          value={meetingTime}
          onChange={(e) => setMeetingTime(e.target.value)}
        />
        <p className="helper-text" style={{ marginTop: 6 }}>
          {visitor.proposed_alternative_time && !visitor.selected_time_slot
            ? "Pre-filled from the guest's proposed alternative time - adjust or save to confirm it."
            : visitor.proposed_time_slots?.length > 0 && !meetingTime
            ? "Guest hasn't picked one of the proposed times yet."
            : "Set or correct the agreed meeting time."}
        </p>

        <label>Checkout time ({COMPANY_TIMEZONE_LABEL})</label>
        <input
          type="datetime-local"
          value={checkedOutAt}
          onChange={(e) => setCheckedOutAt(e.target.value)}
        />
        <p className="helper-text" style={{ marginTop: 6 }}>
          {checkedOutAt
            ? "Clear this field to undo an accidental checkout."
            : visitor.status === "checked_out"
            ? "This visitor was checked out but has no time recorded."
            : "Not checked out yet — only set this if correcting a mistake."}
        </p>

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
