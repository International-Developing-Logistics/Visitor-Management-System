"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { authFetch } from "@/lib/apiFetch";
import { PURPOSE_OPTIONS } from "@/lib/purposeOptions";

function InviteForm() {
  const [hosts, setHosts] = useState([]);
  const [values, setValues] = useState({
    email: "",
    full_name: "",
    host_id: "",
    purpose: "",
    purpose_detail: "",
    notes: "",
  });
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [result, setResult] = useState(null); // { checkinUrl, emailSent, emailError }
  const [copied, setCopied] = useState(false);
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
        body: JSON.stringify({ ...values, purpose: finalPurpose, send_email: alsoEmail }),
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

  const copyLink = async () => {
    await navigator.clipboard.writeText(result.checkinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startOver = () => {
    setResult(null);
    setValues({ email: "", full_name: "", host_id: "", purpose: "", purpose_detail: "", notes: "" });
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

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 12,
            }}
          >
            <input
              type="text"
              readOnly
              value={result.checkinUrl}
              style={{ border: "none", background: "none", padding: 0, flex: 1, fontSize: "0.85rem" }}
              onFocus={(e) => e.target.select()}
            />
            <button className="btn-small" onClick={copyLink} style={{ flexShrink: 0 }}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>

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
          <input type="email" value={values.email} onChange={set("email")} placeholder="guest@example.com" />

          <label>Guest name (optional)</label>
          <input type="text" value={values.full_name} onChange={set("full_name")} placeholder="Jane Cooper" />

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

          <label>Notes (optional)</label>
          <textarea rows={2} value={values.notes} onChange={set("notes")} />

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
    <AdminGuard>
      <main className="kiosk-shell">
        <div className="kiosk-header">
          <div className="brand">Reception<span className="dot">·</span>Invite a guest</div>
        </div>
        <InviteForm />
      </main>
    </AdminGuard>
  );
}
