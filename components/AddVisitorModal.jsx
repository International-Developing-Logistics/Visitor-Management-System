"use client";

import { useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { VISITOR_TYPE_OPTIONS, STRUCTURED_GROUP_VISITOR_TYPE, OTHER_VISITOR_TYPE } from "@/lib/visitorTypes";
import { PURPOSE_OPTIONS } from "@/lib/purposeOptions";
import { companyLocalToUtcIso, COMPANY_TIMEZONE_LABEL } from "@/lib/timezone";

// Lets an admin register a visitor directly from the dashboard - "Admin-
// created visitors". Mirrors VisitorDetailsForm's fields (same validation,
// same visitor_type/group shape rules - see lib/visitorValidation.js on the
// server, which independently re-checks everything this form already
// checks), plus the two things only an admin needs to decide: whether this
// visitor is walking in right now (checked in immediately) or being
// pre-registered for a future visit, and whether to notify the host.
function emptyMember() {
  return { name: "", phone: "" };
}

export default function AddVisitorModal({ hosts, onClose, onCreated }) {
  const [visitMode, setVisitMode] = useState("checked_in"); // "checked_in" | "pre_registered"
  const [values, setValues] = useState({
    full_name: "",
    email: "",
    phone: "",
    company: "",
    visitor_type: "",
    visitor_type_detail: "",
    host_id: "",
    purpose: "",
    notes: "",
    additional_visitor_count: "",
    additional_visitor_names: "",
    group_members: [],
  });
  const [expectedVisitTime, setExpectedVisitTime] = useState("");
  const [notifyHost, setNotifyHost] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isStructuredType = values.visitor_type === STRUCTURED_GROUP_VISITOR_TYPE;
  const isOtherType = values.visitor_type === OTHER_VISITOR_TYPE;
  const groupMembers = values.group_members || [];

  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const setVisitorType = (e) => {
    const nextType = e.target.value;
    const nextIsStructured = nextType === STRUCTURED_GROUP_VISITOR_TYPE;
    setValues({
      ...values,
      visitor_type: nextType,
      visitor_type_detail: nextType === OTHER_VISITOR_TYPE ? values.visitor_type_detail : "",
      group_members: nextIsStructured ? values.group_members : [],
      additional_visitor_count: nextIsStructured ? "" : values.additional_visitor_count,
      additional_visitor_names: nextIsStructured ? "" : values.additional_visitor_names,
    });
  };

  const updateMember = (index, field, value) => {
    const next = groupMembers.map((m, i) => (i === index ? { ...m, [field]: value } : m));
    setValues({ ...values, group_members: next });
  };
  const addMember = () => setValues({ ...values, group_members: [...groupMembers, emptyMember()] });
  const removeMember = (index) => setValues({ ...values, group_members: groupMembers.filter((_, i) => i !== index) });

  const canSave =
    values.full_name.trim() &&
    values.phone.trim() &&
    values.visitor_type &&
    (!isOtherType || values.visitor_type_detail.trim()) &&
    values.host_id &&
    (visitMode === "checked_in" || expectedVisitTime);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const resolvedType = isOtherType
        ? `${OTHER_VISITOR_TYPE}: ${values.visitor_type_detail.trim()}`
        : values.visitor_type;
      const cleanMembers = isStructuredType
        ? groupMembers.filter((m) => m.name.trim() && m.phone.trim())
        : [];
      const payload = {
        full_name: values.full_name.trim(),
        email: values.email.trim() || null,
        phone: values.phone.trim(),
        company: values.company.trim() || null,
        visitor_type: resolvedType,
        host_id: values.host_id,
        purpose: values.purpose || "",
        notes: values.notes || null,
        additional_visitor_count: isStructuredType ? cleanMembers.length : values.additional_visitor_count,
        additional_visitor_names: isStructuredType ? "" : values.additional_visitor_names,
        group_members: cleanMembers,
        visit_mode: visitMode,
        notify_host: notifyHost,
      };
      if (visitMode === "pre_registered") {
        payload.expected_visit_time = companyLocalToUtcIso(expectedVisitTime);
      }
      const res = await authFetch("/api/admin/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated(data.visitor);
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
        <h3>Add visitor</h3>

        <label>Visit type</label>
        <div className="tabs" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={`tab ${visitMode === "checked_in" ? "active" : ""}`}
            onClick={() => setVisitMode("checked_in")}
          >
            Checking in now
          </button>
          <button
            type="button"
            className={`tab ${visitMode === "pre_registered" ? "active" : ""}`}
            onClick={() => setVisitMode("pre_registered")}
          >
            Pre-register for later
          </button>
        </div>

        <label htmlFor="av-visitor-type">Visitor type</label>
        <select id="av-visitor-type" value={values.visitor_type} onChange={setVisitorType}>
          <option value="">Select…</option>
          {VISITOR_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {isOtherType && (
          <>
            <label htmlFor="av-visitor-type-detail">Please specify</label>
            <input
              id="av-visitor-type-detail"
              type="text"
              value={values.visitor_type_detail}
              onChange={set("visitor_type_detail")}
            />
          </>
        )}

        <label>Full name</label>
        <input type="text" value={values.full_name} onChange={set("full_name")} />

        <div className="row-2">
          <div>
            <label>Email (optional)</label>
            <input type="email" value={values.email} onChange={set("email")} />
          </div>
          <div>
            <label>Phone</label>
            <input type="tel" value={values.phone} onChange={set("phone")} />
          </div>
        </div>

        <label>Company</label>
        <input type="text" value={values.company} onChange={set("company")} />

        <label>Host</label>
        <select value={values.host_id} onChange={set("host_id")}>
          <option value="">Select a host…</option>
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>

        <label>Purpose (optional)</label>
        <select value={values.purpose} onChange={set("purpose")}>
          <option value="">Not set yet</option>
          {PURPOSE_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {visitMode === "pre_registered" && (
          <>
            <label>Expected visit time ({COMPANY_TIMEZONE_LABEL})</label>
            <input
              type="datetime-local"
              value={expectedVisitTime}
              onChange={(e) => setExpectedVisitTime(e.target.value)}
            />
            <p className="helper-text" style={{ marginTop: 6 }}>
              If they haven't checked in by the end of this day (plus a day of grace), they'll
              automatically be marked "Did Not Visit".
            </p>
          </>
        )}

        {isStructuredType ? (
          <div>
            <label>Group members</label>
            {groupMembers.map((m, i) => (
              <div key={i} className="row-2" style={{ alignItems: "flex-end", marginBottom: 8 }}>
                <input type="text" value={m.name} onChange={(e) => updateMember(i, "name", e.target.value)} placeholder="Name" />
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="tel"
                    value={m.phone}
                    onChange={(e) => updateMember(i, "phone", e.target.value)}
                    placeholder="Phone"
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn-small" onClick={() => removeMember(i)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn-small" onClick={addMember}>
              + Add person
            </button>
          </div>
        ) : (
          <div>
            <label>Additional visitors</label>
            <input
              type="text"
              inputMode="numeric"
              value={values.additional_visitor_count}
              onChange={set("additional_visitor_count")}
            />
            <label>Additional visitor names</label>
            <textarea rows={2} value={values.additional_visitor_names} onChange={set("additional_visitor_names")} />
          </div>
        )}

        <label>Notes (optional)</label>
        <textarea rows={2} value={values.notes} onChange={set("notes")} />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          <input
            type="checkbox"
            checked={notifyHost}
            onChange={(e) => setNotifyHost(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span style={{ fontWeight: 400, color: "var(--ink)", textTransform: "none", fontSize: "0.9rem" }}>
            Notify the host by email
          </span>
        </label>

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 0 }} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} style={{ marginTop: 0 }} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Add visitor"}
          </button>
        </div>
      </div>
    </div>
  );
}
