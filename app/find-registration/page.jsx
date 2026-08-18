"use client";

import { useState } from "react";
import BrandHeader from "@/components/BrandHeader";

export default function FindRegistrationPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/find-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
        <BrandHeader label="Find my pre-registration" />
      </div>

      <div className="card">
        {submitted ? (
          <div className="confirm-wrap">
            <div className="confirm-icon">✓</div>
            <h2>Check your email</h2>
            <p className="helper-text">
              If we found a matching pre-registration, we've emailed you the link to continue.
            </p>
          </div>
        ) : (
          <div>
            <h3>Find my pre-registration</h3>
            <p className="helper-text" style={{ marginBottom: 4 }}>
              Lost your check-in link? Enter the email you registered with and we'll send it again.
            </p>

            <label htmlFor="find-reg-email">Email address</label>
            <input
              id="find-reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
            />

            {error && <p className="error-text">{error}</p>}

            <button className="btn btn-primary" onClick={submit} disabled={submitting || !email.trim()}>
              {submitting ? "Searching…" : "Send my link"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
