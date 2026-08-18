"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { authFetch } from "@/lib/apiFetch";
import { PURPOSE_OPTIONS } from "@/lib/purposeOptions";
import BrandHeader from "@/components/BrandHeader";
import TimeSlotEditor from "@/components/TimeSlotEditor";
import HyperlinkCopier from "@/components/HyperlinkCopier";
import { companyLocalToUtcIso } from "@/lib/timezone";

function InviteForm() {
  const [hosts, setHosts] = useState([]);
  const [values, setValues] = useState({
    email: "",
    full_name: "",
    host_id: "",
    purpose: "",
    purpose_detail: "",
    notes: "",
    is_group: false,
    additional_visitor_count: "",
    additional_visitor_names: "",
  });
  const [timeSlots, setTimeSlots] = useState([]);
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [result, setResult] = useState(null); // { checkinUrl, emailSent, emailError }
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/hosts").then((r) => r.json()).then((d) => setHosts(d.hosts || []));
  }, []);

  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const submit = async () => {
    setSubmitting(true);
    setError("");
    const finalPurpose =
      values.purpose === "Other" && values.purpose_detail
        ? `Other: ${values.purpose_detail}`
        : values.purpose;
    try {
      const res = await authFetch("/api/preregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          purpose: finalPurpose,
          additional_visitor_count: values.is_group ? values.additional_visitor_count : 0,
          additional_visitor_names: values.is_group ? values.additional_visitor_names : "",
          proposed_time_slots: timeSlots.filter(Boolean).map(companyLocalToUtcIso).filter(Boolean),
          send_email: alsoEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => {
    setResult(null);
    setValues({
      email: "",
      full_name: "",
      host_id: "",
      purpose: "",
      purpose_detail: "",
      notes: "",
      is_group: false,
      additional_visitor_count: "",
      additional_visitor_names: "",
    });
    setTimeSlots([]);
  };

  return (
    <div className="card">
      {result ? (
        <div>
          <div className="confirm-wrap" style={{ paddingBottom: 8 }}>
            <div className="confirm-icon">✓</div>
            <h2>Link ready</h2>
            <p className="helper-text" style={{ marginBottom: 20 }}>
              Share this with your guest however you like — email, WhatsApp, Slack, text.
            </p>
          </div>

          <HyperlinkCopier url={result.checkinUrl} defaultText="Click here to complete your pre-registration" />

          {alsoEmail && (
            <p className={result.emailSent ? "helper-text" : "error-text"}>
              {result.emailSent
                ? "Also emailed to the guest."
                : `Email didn't send${result.emailError ? ` (${result.emailError})` : ""} — the link above still works, just share it manually.`}
            </p>
          )}

          <button className="btn btn-secondary" onClick={startOver}>
            Invite another guest
          </button>
        </div>
      ) : (
        <div>
          <h3>Invite a guest</h3>
          <label>Guest email</label>
          <input type="email" value={values.email} onChange={set("email")} placeholder="Enter guest's email address" />

          <label>Guest name (optional)</label>
          <input type="text" value={values.full_name} onChange={set("full_name")} placeholder="Enter guest's full name" />

          <label>Host (you)</label>
          <select value={values.host_id} onChange={set("host_id")}>
            <option value="">Select…</option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>

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
                value={values.purpose_detail}
                onChange={set("purpose_detail")}
                placeholder="Briefly describe the purpose"
              />
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
            <input
              type="checkbox"
              checked={values.is_group}
              onChange={(e) =>
                setValues({
                  ...values,
                  is_group: e.target.checked,
                  additional_visitor_count: e.target.checked ? values.additional_visitor_count || "1" : "",
                })
              }
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontWeight: 400, color: "var(--ink)", textTransform: "none", fontSize: "0.9rem" }}>
              This guest is bringing others
            </span>
          </label>

          {values.is_group && (
            <div>
              <label>How many additional visitors?</label>
              <input
                type="text"
                inputMode="numeric"
                value={values.additional_visitor_count}
                onChange={set("additional_visitor_count")}
                placeholder="e.g. 2"
              />
              <label>Their names (optional)</label>
              <textarea
                rows={2}
                value={values.additional_visitor_names}
                onChange={set("additional_visitor_names")}
                placeholder="One name per line, or comma-separated"
              />
            </div>
          )}

          <label>Notes (optional)</label>
          <textarea rows={2} value={values.notes} onChange={set("notes")} />

          <label>Proposed meeting times (optional)</label>
          <TimeSlotEditor slots={timeSlots} onChange={setTimeSlots} />

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
            <input
              type="checkbox"
              checked={alsoEmail}
              onChange={(e) => setAlsoEmail(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontWeight: 400, color: "var(--ink)", textTransform: "none", fontSize: "0.9rem" }}>
              Also email the link to the guest
            </span>
          </label>

          {error && <p className="error-text">{error}</p>}

          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={
              submitting ||
              !values.email ||
              !values.host_id ||
              !values.purpose ||
              (values.purpose === "Other" && !values.purpose_detail.trim())
            }
          >
            {submitting ? "Generating…" : "Generate link"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PreregisterInvitePage() {
  return (
    <AdminGuard requiredRole="admin">
      <main className="kiosk-shell">
        <div className="kiosk-header">
          <BrandHeader label="Invite a guest" />
        </div>
        <InviteForm />
      </main>
    </AdminGuard>
  );
}
