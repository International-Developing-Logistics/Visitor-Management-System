"use client";

import { useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import { AVAILABLE_EQUIPMENT } from "@/lib/equipment";

// facility: { key, label, logo, logoHeight } from lib/facilities.js
export default function EquipmentRequestForm({ facility }) {
  const [values, setValues] = useState({ employee_name: "", equipment: "", location: "", estimated_time: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/equipment-requests", {
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
        <BrandHeader label="Equipment request" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div className="card">
        {submitted ? (
          <div className="confirm-wrap">
            <div className="confirm-icon">✓</div>
            <h2>Request sent</h2>
            <p className="helper-text">
              Your request has been submitted for admin review.
            </p>
          </div>
        ) : (
          <div>
            <h3>Request equipment</h3>

            <label htmlFor="eq-name">Your name</label>
            <input id="eq-name" type="text" value={values.employee_name} onChange={set("employee_name")} placeholder="Enter your full name" />

            <label htmlFor="eq-equipment">Equipment</label>
            <select id="eq-equipment" value={values.equipment} onChange={set("equipment")}>
              <option value="">Select equipment…</option>
              {AVAILABLE_EQUIPMENT.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>

            <label htmlFor="eq-location">Location / area needed</label>
            <input id="eq-location" type="text" value={values.location} onChange={set("location")} placeholder="Where will it be used?" />

            <label htmlFor="eq-time">Estimated time needed</label>
            <input
              id="eq-time"
              type="text"
              value={values.estimated_time}
              onChange={set("estimated_time")}
              placeholder="e.g. 2 hours, all day Thursday"
            />

            {error && <p className="error-text">{error}</p>}

            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={submitting || !values.employee_name.trim() || !values.equipment}
            >
              {submitting ? "Sending…" : "Submit request"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
