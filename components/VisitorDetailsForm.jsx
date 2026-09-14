"use client";

import { VISITOR_TYPE_OPTIONS, STRUCTURED_GROUP_VISITOR_TYPE, OTHER_VISITOR_TYPE } from "@/lib/visitorTypes";
import { VISITOR_AGREEMENT_TEXT } from "@/lib/agreementText";

// Shared by the self-service kiosk check-in (WalkinForm) and open
// pre-registration (PreregisterOpenForm). "Purpose of visit" was removed
// from this form by design — it's now an admin-assigned field added after
// check-in from the Visitors dashboard, rather than something a visitor
// picks off a list on their way in. Visitor Type replaces it as the
// required, visitor-facing categorization, and it also decides the shape
// of the group section below: a structured name+phone list for Business/
// Client visitors, or the simpler count + optional names for everyone else.
//
// showAgreementNotice / submitLabel / submitting / busyLabel: this form has
// no agreement step of its own anymore — when it IS the last screen before
// submission (true for the walk-in kiosk, but not open pre-registration,
// which has a Time step after this one), the parent passes
// showAgreementNotice to show the visitor-terms notice right above the
// button, and submitLabel/busyLabel to make that button read like the
// final "Register" action rather than "Continue".
function emptyMember() {
  return { name: "", phone: "" };
}

export default function VisitorDetailsForm({
  hosts,
  values,
  onChange,
  onNext,
  showAgreementNotice = false,
  submitLabel = "Continue",
  submitting = false,
  busyLabel = null,
}) {
  const set = (field) => (e) => onChange({ ...values, [field]: e.target.value });

  const isGroup = values.is_group;
  const isStructuredType = values.visitor_type === STRUCTURED_GROUP_VISITOR_TYPE;
  const isOtherType = values.visitor_type === OTHER_VISITOR_TYPE;
  const groupMembers = values.group_members || [];

  const groupCountValid =
    !isGroup ||
    isStructuredType ||
    (Number(values.additional_visitor_count) > 0 && Number.isFinite(Number(values.additional_visitor_count)));

  const groupMembersValid =
    !isGroup ||
    !isStructuredType ||
    (groupMembers.length > 0 && groupMembers.every((m) => m.name.trim() && m.phone.trim()));

  const canContinue =
    values.full_name.trim() &&
    values.phone.trim() &&
    values.visitor_type &&
    (!isOtherType || (values.visitor_type_detail || "").trim()) &&
    values.host_id &&
    groupCountValid &&
    groupMembersValid;

  // Switching visitor type while a group is already entered would leave
  // stale data in the shape the new type doesn't use (e.g. typed group
  // members left behind after switching from Business to Vendor) — clear
  // whichever shape no longer applies so the two representations never
  // silently disagree with each other. Same idea for visitor_type_detail:
  // clear it whenever the type isn't "Other" so a stale detail can't get
  // silently carried over and combined into a later, unrelated type.
  const setVisitorType = (e) => {
    const nextType = e.target.value;
    const nextIsStructured = nextType === STRUCTURED_GROUP_VISITOR_TYPE;
    onChange({
      ...values,
      visitor_type: nextType,
      visitor_type_detail: nextType === OTHER_VISITOR_TYPE ? values.visitor_type_detail || "" : "",
      group_members: nextIsStructured ? values.group_members || [] : [],
      additional_visitor_count: nextIsStructured ? "" : values.additional_visitor_count,
      additional_visitor_names: nextIsStructured ? "" : values.additional_visitor_names,
    });
  };

  const toggleGroup = (e) => {
    const checked = e.target.checked;
    onChange({
      ...values,
      is_group: checked,
      additional_visitor_count: checked && !isStructuredType ? values.additional_visitor_count || "1" : "",
      additional_visitor_names: checked && !isStructuredType ? values.additional_visitor_names : "",
      group_members: checked && isStructuredType ? (values.group_members?.length ? values.group_members : [emptyMember()]) : [],
    });
  };

  const updateMember = (index, field, value) => {
    const next = groupMembers.map((m, i) => (i === index ? { ...m, [field]: value } : m));
    onChange({ ...values, group_members: next });
  };

  const addMember = () => onChange({ ...values, group_members: [...groupMembers, emptyMember()] });
  const removeMember = (index) => onChange({ ...values, group_members: groupMembers.filter((_, i) => i !== index) });

  return (
    <div>
      <label htmlFor="vd-visitor-type">Visitor type</label>
      <select id="vd-visitor-type" value={values.visitor_type} onChange={setVisitorType}>
        <option value="">Select…</option>
        {VISITOR_TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {isOtherType && (
        <div>
          <label htmlFor="vd-visitor-type-detail">Please specify</label>
          <input
            id="vd-visitor-type-detail"
            type="text"
            value={values.visitor_type_detail || ""}
            onChange={set("visitor_type_detail")}
            placeholder="What brings you here today?"
          />
        </div>
      )}

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

      <label htmlFor="vd-host">Who are you visiting?</label>
      <select id="vd-host" value={values.host_id} onChange={set("host_id")}>
        <option value="">Select a host…</option>
        {hosts.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
        <input type="checkbox" checked={isGroup} onChange={toggleGroup} style={{ width: 16, height: 16 }} />
        <span style={{ fontWeight: 400, color: "var(--ink)", textTransform: "none", fontSize: "0.9rem" }}>
          I'm checking in with others
        </span>
      </label>

      {isGroup && isStructuredType && (
        <div>
          <p className="helper-text" style={{ marginTop: 12, marginBottom: 6 }}>
            Add each additional person's name and phone number.
          </p>
          {groupMembers.map((m, i) => (
            <div key={i} className="row-2" style={{ alignItems: "flex-end" }}>
              <div>
                <label htmlFor={`vd-gm-name-${i}`}>{`Person ${i + 1} name`}</label>
                <input
                  id={`vd-gm-name-${i}`}
                  type="text"
                  value={m.name}
                  onChange={(e) => updateMember(i, "name", e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor={`vd-gm-phone-${i}`}>Phone</label>
                  <input
                    id={`vd-gm-phone-${i}`}
                    type="tel"
                    value={m.phone}
                    onChange={(e) => updateMember(i, "phone", e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
                {groupMembers.length > 1 && (
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => removeMember(i)}
                    style={{ marginBottom: 2 }}
                    aria-label={`Remove person ${i + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="btn-small" onClick={addMember} style={{ marginTop: 4 }}>
            + Add another person
          </button>
        </div>
      )}

      {isGroup && !isStructuredType && (
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

      {showAgreementNotice && <div className="nda-box">{VISITOR_AGREEMENT_TEXT}</div>}

      <button className="btn btn-primary" onClick={onNext} disabled={!canContinue || submitting}>
        {submitting && busyLabel ? busyLabel : submitLabel}
      </button>
    </div>
  );
}
