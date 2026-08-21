"use client";

import { useEffect, useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import HyperlinkCopier from "@/components/HyperlinkCopier";
import ImageOptionGrid from "@/components/ImageOptionGrid";
import { AVAILABLE_VEHICLES } from "@/lib/vehicles";

export default function VehicleRequestForm({ facility }) {
  const [values, setValues] = useState({
    employee_name: "",
    vehicle: "",
    destination: "",
    estimated_time: "",
    customer_name: "",
  });
  const [isExternal, setIsExternal] = useState(false);
  const [inUse, setInUse] = useState({});
  const [statusUrl, setStatusUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/vehicle-requests/availability?facility=${facility.key}`)
      .then((r) => r.json())
      .then((d) => {
        const messages = {};
        for (const [name, employee] of Object.entries(d.inUse || {})) {
          messages[name] = `${employee} is currently using this vehicle/equipment.`;
        }
        setInUse(messages);
      })
      .catch(() => setInUse({}));
  }, [facility.key]);

  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const canSubmit = isExternal
    ? values.employee_name.trim() && values.customer_name.trim() && values.destination.trim()
    : values.employee_name.trim() && values.vehicle && values.destination.trim();

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/vehicle-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          is_external: isExternal,
          facility: facility.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const origin = window.location.origin;
      setStatusUrl(`${origin}/vehicle-request/status?token=${data.request.approval_token}`);
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
          <div>
            <div className="confirm-wrap" style={{ paddingBottom: 8 }}>
              <div className="confirm-icon">✓</div>
              <h2>Request sent</h2>
            </div>
            <HyperlinkCopier url={statusUrl} defaultText="Check my vehicle request status" />
          </div>
        ) : (
          <div>
            <h3>Request a company vehicle</h3>

            <label htmlFor="vr-name">Your name</label>
            <input id="vr-name" type="text" value={values.employee_name} onChange={set("employee_name")} placeholder="Enter your full name" />

            <fieldset disabled={isExternal} style={{ border: "none", padding: 0, margin: 0, opacity: isExternal ? 0.45 : 1 }}>
              <label>Vehicle</label>
              <ImageOptionGrid
                items={AVAILABLE_VEHICLES}
                selected={values.vehicle}
                onChange={(vehicle) => setValues({ ...values, vehicle })}
                unavailable={isExternal ? {} : inUse}
              />
            </fieldset>

            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 4px" }}>
              <input
                type="checkbox"
                checked={isExternal}
                onChange={(e) => setIsExternal(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 400, color: "var(--ink)", textTransform: "none", fontSize: "0.9rem" }}>
                Request an external vehicle
              </span>
            </label>

            {isExternal && (
              <div>
                <label htmlFor="vr-customer">Customer name</label>
                <input id="vr-customer" type="text" value={values.customer_name} onChange={set("customer_name")} placeholder="Enter the customer's name" />
              </div>
            )}

            <label htmlFor="vr-destination">Destination</label>
            <input id="vr-destination" type="text" value={values.destination} onChange={set("destination")} placeholder="Where are you going?" />

            <fieldset disabled={isExternal} style={{ border: "none", padding: 0, margin: 0, opacity: isExternal ? 0.45 : 1 }}>
              <label htmlFor="vr-time">Estimated time needed</label>
              <input id="vr-time" type="text" value={values.estimated_time} onChange={set("estimated_time")} />
            </fieldset>

            {error && <p className="error-text">{error}</p>}

            <button className="btn btn-primary" onClick={submit} disabled={submitting || !canSubmit}>
              {submitting ? "Sending…" : "Submit request"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
