"use client";

import { PURPOSE_OPTIONS } from "@/lib/purposeOptions";

export default function VisitorDetailsForm({ hosts, values, onChange, onNext }) {
  const set = (field) => (e) => onChange({ ...values, [field]: e.target.value });

  const canContinue =
    values.full_name.trim() &&
    values.email.trim() &&
    values.purpose.trim() &&
    (values.purpose !== "Other" || values.purpose_detail?.trim()) &&
    values.host_id;

  return (
    <div>
      <label>Full name</label>
      <input type="text" value={values.full_name} onChange={set("full_name")} placeholder="Jane Cooper" />

      <div className="row-2">
        <div>
          <label>Email</label>
          <input type="email" value={values.email} onChange={set("email")} placeholder="jane@example.com" />
        </div>
        <div>
          <label>Phone</label>
          <input type="tel" value={values.phone} onChange={set("phone")} placeholder="+971 50 000 0000" />
        </div>
      </div>

      <label>Company / organization</label>
      <input type="text" value={values.company} onChange={set("company")} placeholder="Acme Inc." />

      <label>Purpose of visit</label>
      <select value={values.purpose} onChange={set("purpose")}>
        <option value="">Select…</option>
        {PURPOSE_OPTIONS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {values.purpose === "Other" && (
        <div>
          <label>Please specify</label>
          <input
            type="text"
            value={values.purpose_detail || ""}
            onChange={set("purpose_detail")}
            placeholder="Briefly describe the purpose"
          />
        </div>
      )}

      <label>Who are you visiting?</label>
      <select value={values.host_id} onChange={set("host_id")}>
        <option value="">Select a host…</option>
        {hosts.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>

      <label>Notes (optional)</label>
      <textarea rows={2} value={values.notes} onChange={set("notes")} placeholder="Anything your host should know" />

      <button className="btn btn-primary" onClick={onNext} disabled={!canContinue}>
        Continue
      </button>
    </div>
  );
}
