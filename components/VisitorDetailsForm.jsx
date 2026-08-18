"use client";

import { PURPOSE_OPTIONS } from "@/lib/purposeOptions";

export default function VisitorDetailsForm({ hosts, values, onChange, onNext }) {
  const set = (field) => (e) => onChange({ ...values, [field]: e.target.value });

  const isGroup = values.is_group;
  const groupCountValid =
    !isGroup || (Number(values.additional_visitor_count) > 0 && Number.isFinite(Number(values.additional_visitor_count)));

  const canContinue =
    values.full_name.trim() &&
    values.purpose.trim() &&
    (values.purpose !== "Other" || values.purpose_detail?.trim()) &&
    values.host_id &&
    groupCountValid;

  return (
    <div>
      <label htmlFor="vd-full-name">Full name</label>
      <input id="vd-full-name" type="text" value={values.full_name} onChange={set("full_name")} placeholder="Enter your full name" />

      <div className="row-2">
        <div>
          <label htmlFor="vd-email">Email (optional)</label>
          <input id="vd-email" type="email" value={values.email} onChange={set("email")} placeholder="Enter your email address" />
        </div>
        <div>
          <label htmlFor="vd-phone">Phone</label>
          <input id="vd-phone" type="tel" value={values.phone} onChange={set("phone")} placeholder="Enter your phone number" />
        </div>
      </div>

      <label htmlFor="vd-company">Company / organization</label>
      <input id="vd-company" type="text" value={values.company} onChange={set("company")} placeholder="Enter your company name" />

      <label htmlFor="vd-purpose">Purpose of visit</label>
      <select id="vd-purpose" value={values.purpose} onChange={set("purpose")}>
        <option value="">Select…</option>
        {PURPOSE_OPTIONS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {values.purpose === "Other" && (
        <div>
          <label htmlFor="vd-purpose-detail">Please specify</label>
          <input
            id="vd-purpose-detail"
            type="text"
            value={values.purpose_detail || ""}
            onChange={set("purpose_detail")}
            placeholder="Briefly describe the purpose"
          />
        </div>
      )}

      <label htmlFor="vd-host">Who are you visiting?</label>
      <select id="vd-host" value={values.host_id} onChange={set("host_id")}>
        <option value="">Select a host…</option>
        {hosts.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
        <input
          type="checkbox"
          checked={isGroup}
          onChange={(e) =>
            onChange({
              ...values,
              is_group: e.target.checked,
              additional_visitor_count: e.target.checked ? values.additional_visitor_count || "1" : "",
              additional_visitor_names: e.target.checked ? values.additional_visitor_names : "",
            })
          }
          style={{ width: 16, height: 16 }}
        />
        <span style={{ fontWeight: 400, color: "var(--ink)", textTransform: "none", fontSize: "0.9rem" }}>
          I'm checking in with others
        </span>
      </label>

      {isGroup && (
        <div>
          <label htmlFor="vd-group-count">How many additional visitors?</label>
          <input
            id="vd-group-count"
            type="text"
            inputMode="numeric"
            value={values.additional_visitor_count}
            onChange={set("additional_visitor_count")}
            placeholder="e.g. 2"
          />
          <label htmlFor="vd-group-names">Their names (optional)</label>
          <textarea
            id="vd-group-names"
            rows={2}
            value={values.additional_visitor_names}
            onChange={set("additional_visitor_names")}
            placeholder="One name per line, or comma-separated"
          />
        </div>
      )}

      <label htmlFor="vd-notes">Notes (optional)</label>
      <textarea id="vd-notes" rows={2} value={values.notes} onChange={set("notes")} placeholder="Anything your host should know" />

      <button className="btn btn-primary" onClick={onNext} disabled={!canContinue}>
        Continue
      </button>
    </div>
  );
}
