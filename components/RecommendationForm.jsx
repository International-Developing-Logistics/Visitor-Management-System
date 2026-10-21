"use client";

import { useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import BrandHeader from "@/components/BrandHeader";
import { authFetch } from "@/lib/apiFetch";

export default function RecommendationForm() {
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await authFetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
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
    <AdminGuard>
      <main className="kiosk-shell">
        <div className="kiosk-header">
          <BrandHeader label="Suggest a feature" />
        </div>

        <div className="card">
          {submitted ? (
            <div className="confirm-wrap">
              <div className="confirm-icon">✓</div>
              <h2>Thanks!</h2>
              <p className="helper-text">Thank you for the suggestion!</p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSubmitted(false);
                  setDescription("");
                }}
              >
                Suggest another
              </button>
            </div>
          ) : (
            <div>
              <h3>Suggest a feature</h3>
              <p className="helper-text" style={{ marginBottom: 18 }}>
                What would you like something added or changed?
              </p>

              <label htmlFor="rec-description">Your suggestion</label>
              <textarea
                id="rec-description"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. request form for equipment use"
              />

              {error && <p className="error-text">{error}</p>}

              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={submitting || !description.trim()}
              >
                {submitting ? "Sending…" : "Send suggestion"}
              </button>
            </div>
          )}
        </div>
      </main>
    </AdminGuard>
  );
}
