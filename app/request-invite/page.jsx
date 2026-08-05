"use client";

import { useEffect, useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import { PURPOSE_OPTIONS } from "@/lib/purposeOptions";

export default function RequestInvitePage() {
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
  const [submitted, setSubmitted] = useState(false);
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
      const res = await fetch("/api/request-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          purpose: finalPurpose,
          additional_visitor_count: values.is_group ? values.additional_visitor_count : 0,
          additional_visitor_names: values.is_group ? values.additional_visitor_names : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Request a guest invite" />
      </div>

      <div className="card">
        {submitted ? (
          <div className="confirm-wrap">
            <div className="confirm-icon">✓</div>
            <h2>Request sent</h2>
            <p className="helper-text">
              Reception will review this and send your guest their pre-registration link.
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSubmitted(false);
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
              }}
            >
              Request another
            </button>
          </div>
        ) : (
          <div>
            <h3>Request a guest invite</h3>
            <p className="helper-text" style={{ marginBottom: 4 }}>
              Reception will review this and send the pre-registration link to your guest.
            </p>

            <label>Guest email</label>
            <input type="email" value={values.email} onChange={set("email")} placeholder="guest@example.com" />

            <label>Guest name (optional)</label>
            <input type="text" value={values.full_name} onChange={set("full_name")} placeholder="Jane Cooper" />

            <label>You are</label>
            <select value={values.host_id} onChange={set("host_id")}>
              <option value="">Select your name…</option>
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

            <label>Notes for reception (optional)</label>
            <textarea rows={2} value={values.notes} onChange={set("notes")} />

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
              {submitting ? "Sending request…" : "Send request"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
