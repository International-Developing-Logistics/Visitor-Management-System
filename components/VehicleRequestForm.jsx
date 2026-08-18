"use client";

import { useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import { AVAILABLE_VEHICLES } from "@/lib/vehicles";

// facility: { key, label, logo, logoHeight } from lib/facilities.js
export default function VehicleRequestForm({ facility }) {
  const [values, setValues] = useState({ employee_name: "", vehicle: "", destination: "", estimated_time: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/vehicle-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, facility: facility.key }),
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
        <BrandHeader label="Vehicle request" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div className="card">
        {submitted ? (
          <div className="confirm-wrap">
            <div className="confirm-icon">✓</div>
            <h2>Request sent</h2>
            <p className="helper-text">
              Transport coordinators have been notified. You'll be able to check the status
              with reception or security once it's reviewed.
            </p>
          </div>
        ) : (
          <div>
            <h3>Request a company vehicle</h3>

            <label>Your name</label>
            <input type="text" value={values.employee_name} onChange={set("employee_name")} placeholder="Jane Cooper" />

            <label>Vehicle</label>
            <select value={values.vehicle} onChange={set("vehicle")}>
              <option value="">Select a vehicle…</option>
              {AVAILABLE_VEHICLES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            <label>Destination</label>
            <input type="text" value={values.destination} onChange={set("destination")} placeholder="Where are you going?" />

            <label>Estimated time needed</label>
            <input
              type="text"
              value={values.estimated_time}
              onChange={set("estimated_time")}
              placeholder="e.g. 2 hours, 9am–12pm tomorrow"
            />

            {error && <p className="error-text">{error}</p>}

            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={submitting || !values.employee_name.trim() || !values.vehicle || !values.destination.trim()}
            >
              {submitting ? "Sending…" : "Submit request"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
