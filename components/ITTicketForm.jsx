"use client";

import { useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import BrandHeader from "@/components/BrandHeader";
import { authFetch } from "@/lib/apiFetch";

// Staff Hub only - admin and staff accounts, not guard (a guard needs a
// staff member to report an issue for them). Module-level constant so
// AdminGuard's effect doesn't re-run every render (see its own comments).
const ALLOWED_ROLES = ["admin", "staff"];

const PRIORITIES = ["low", "normal", "urgent"];
const PRIORITY_LABEL = { low: "Low", normal: "Normal", urgent: "Urgent" };

export default function ITTicketForm({ facility }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await authFetch("/api/it-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitter_name: name,
          submitter_email: email,
          description,
          priority,
          facility: facility.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminGuard allowedRoles={ALLOWED_ROLES}>
      <main className="kiosk-shell">
        <div className="kiosk-header">
          <BrandHeader label="IT Ticket" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
        </div>

        <div className="card">
          {submitted ? (
            <div className="confirm-wrap">
              <div className="confirm-icon">✓</div>
              <h2>Ticket submitted</h2>
              <p className="helper-text">We'll follow up at the email you gave if we need more info.</p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSubmitted(false);
                  setName("");
                  setEmail("");
                  setDescription("");
                  setPriority("normal");
                }}
              >
                Submit another
              </button>
            </div>
          ) : (
            <div>
              <h3>Report an IT issue</h3>
              <p className="helper-text" style={{ marginBottom: 18 }}>
                Broken hardware, software problems, account access - anything IT-related.
              </p>

              <label htmlFor="ticket-name">Your name</label>
              <input id="ticket-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />

              <label htmlFor="ticket-email">Your email</label>
              <input id="ticket-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

              <label htmlFor="ticket-priority">Priority</label>
              <select id="ticket-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                ))}
              </select>

              <label htmlFor="ticket-description">What's going on?</label>
              <textarea
                id="ticket-description"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. the reception printer won't turn on"
              />

              {error && <p className="error-text">{error}</p>}

              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={submitting || !name.trim() || !email.trim() || !description.trim()}
              >
                {submitting ? "Sending…" : "Submit ticket"}
              </button>
            </div>
          )}
        </div>
      </main>
    </AdminGuard>
  );
}
