"use client";

import { useEffect, useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import ImageOptionGrid from "@/components/ImageOptionGrid";
import { AVAILABLE_EQUIPMENT } from "@/lib/equipment";

export default function EquipmentRequestForm({ facility }) {
  const [employeeName, setEmployeeName] = useState("");
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [needsRental, setNeedsRental] = useState(false);
  const [rentalDescription, setRentalDescription] = useState("");
  const [location, setLocation] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [inUse, setInUse] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/equipment-requests/availability?facility=${facility.key}`)
      .then((r) => r.json())
      .then((d) => {
        const messages = {};
        for (const [name, employee] of Object.entries(d.inUse || {})) {
          messages[name] = `${employee} is currently using this equipment.`;
        }
        setInUse(messages);
      })
      .catch(() => setInUse({}));
  }, [facility.key]);

  const toggleRental = (checked) => {
    setNeedsRental(checked);
    if (checked) setEquipmentItems([]); 
  };

  const canSubmit =
    employeeName.trim() &&
    (needsRental ? rentalDescription.trim() : equipmentItems.length > 0);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/equipment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_name: employeeName,
          equipment_items: needsRental ? [] : equipmentItems,
          external_rental_request: needsRental ? rentalDescription : null,
          location,
          estimated_time: estimatedTime,
          facility: facility.key,
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
        <BrandHeader label="Equipment request" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div className="card">
        {submitted ? (
          <div className="confirm-wrap">
            <div className="confirm-icon">✓</div>
            <h2>Request sent</h2>
          </div>
        ) : (
          <div>
            <h3>Request equipment</h3>

            <label htmlFor="eq-name">Your name</label>
            <input id="eq-name" type="text" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="Enter your full name" />

            <fieldset disabled={needsRental} style={{ border: "none", padding: 0, margin: 0, opacity: needsRental ? 0.45 : 1 }}>
              <label>Equipment (select any that apply)</label>
              <ImageOptionGrid
                items={AVAILABLE_EQUIPMENT}
                selected={equipmentItems}
                onChange={setEquipmentItems}
                multi
                unavailable={needsRental ? {} : inUse}
              />
            </fieldset>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
              <input
                type="checkbox"
                checked={needsRental}
                onChange={(e) => toggleRental(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 400, color: "var(--ink)", textTransform: "none", fontSize: "0.9rem" }}>
                Request a third-party rental
              </span>
            </label>

            {needsRental && (
              <div>
                <label htmlFor="eq-rental">Describe the equipment needed</label>
                <textarea
                  id="eq-rental"
                  rows={2}
                  value={rentalDescription}
                  onChange={(e) => setRentalDescription(e.target.value)}
                  placeholder="e.g. Mobile crane, scissor lift, etc..."
                />
              </div>
            )}

            <label htmlFor="eq-location">Location / area needed</label>
            <input id="eq-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where will it be used?" />

            <label htmlFor="eq-time">Estimated time needed</label>
            <input
              id="eq-time"
              type="text"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              placeholder="eg. 2 hours"
            />

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
