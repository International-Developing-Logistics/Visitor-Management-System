"use client";

import { useState } from "react";
import BrandHeader from "@/components/BrandHeader";

// facility: { key, label, logo } from lib/facilities.js
export default function GateForm({ facility }) {
  const [full_name, setFullName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, purpose, facility: facility.key }),
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
        <BrandHeader label="Gate entry" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div className="card">
        {submitted ? (
          <div className="confirm-wrap">
            <div className="confirm-icon">✓</div>
            <h2>Thank you</h2>
            <p className="helper-text">
              Your request has been sent for approval. Please wait here — once approved,
              you can proceed to reception to check in.
            </p>
          </div>
        ) : (
          <div>
            <h3>Gate entry request</h3>
            <p className="helper-text" style={{ marginBottom: 4 }}>
              Please provide your details for approval before entering.
            </p>

            <label>Full name</label>
            <input type="text" value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Cooper" />

            <label>Purpose of visit</label>
            <input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Delivery, meeting, interview…" />

            {error && <p className="error-text">{error}</p>}

            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={submitting || !full_name.trim() || !purpose.trim()}
            >
              {submitting ? "Submitting…" : "Submit for approval"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
