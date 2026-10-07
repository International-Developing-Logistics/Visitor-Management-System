"use client";

import { useEffect, useState } from "react";
import CameraCapture from "@/components/CameraCapture";
import BrandHeader from "@/components/BrandHeader";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { FACILITIES } from "@/lib/facilities";

// The page a physical QR code lands on. One form, two shapes, decided by
// the unit's current state (fetched fresh on load, not passed in) - this
// is what makes a second "pick up" scan on an already-checked-out unit
// impossible from the UI: there's no pickup form to show, only the return
// one. See app/api/equipment-log/route.js POST for the server-side
// backstop against the same thing.
export default function EquipmentLogForm({ unitId }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [unit, setUnit] = useState(null);
  const [active, setActive] = useState(null);
  const [done, setDone] = useState(null); // "checked_out" | "checked_in" | null

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/equipment-log?unit=${encodeURIComponent(unitId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUnit(data.unit);
      setActive(data.active);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  const facility = unit ? FACILITIES[unit.facility] : null;

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Equipment Log" companyName={facility?.label} logoSrc={facility?.logo} logoHeight={facility?.logoHeight} />
      </div>

      <div className="card">
        {loading && <p className="helper-text">Loading…</p>}
        {!loading && loadError && <p className="error-text">{loadError}</p>}

        {!loading && !loadError && unit && !done && (
          active ? (
            <ReturnForm unit={unit} active={active} onDone={() => setDone("checked_in")} />
          ) : (
            <CheckoutForm unit={unit} onDone={() => setDone("checked_out")} />
          )
        )}

        {done === "checked_out" && (
          <div className="confirm-wrap">
            <div className="confirm-icon">✓</div>
            <h2>Checked out</h2>
            <p style={{ color: "var(--muted)" }}>
              {unit.name} is logged as in use. Scan this same code again when you're done to return it.
            </p>
          </div>
        )}

        {done === "checked_in" && (
          <div className="confirm-wrap">
            <div className="confirm-icon">✓</div>
            <h2>Checked in</h2>
            <p style={{ color: "var(--muted)" }}>{unit.name} is logged as available again.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function CheckoutForm({ unit, onDone }) {
  const [userName, setUserName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/equipment-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit_id: unit.id, user_name: userName, facility: unit.facility }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3>{unit.name}</h3>
      <p className="helper-text" style={{ marginTop: 0, marginBottom: 16 }}>
        {unit.type} · Available - check it out below.
      </p>

      <label htmlFor="eq-user-name">Your name (company or employee)</label>
      <input
        id="eq-user-name"
        type="text"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        placeholder="Enter your name"
      />

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary" onClick={submit} disabled={submitting || !userName.trim()}>
        {submitting ? "Checking out…" : "Check out"}
      </button>
    </div>
  );
}

function ReturnForm({ unit, active, onDone }) {
  const [hourMeterPhoto, setHourMeterPhoto] = useState(null);
  const [damaged, setDamaged] = useState(false);
  const [damagePhoto, setDamagePhoto] = useState(null);
  const [damageNotes, setDamageNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = !!hourMeterPhoto && (!damaged || !!damagePhoto);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/equipment-log/${active.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hour_meter_photo: hourMeterPhoto,
          damaged,
          damage_photo: damaged ? damagePhoto : null,
          damage_notes: damaged ? damageNotes : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3>{unit.name}</h3>
      <p className="helper-text" style={{ marginTop: 0, marginBottom: 16 }}>
        Checked out to {active.user_name} · since {formatInCompanyTimezone(active.checked_out_at)}
      </p>

      <label htmlFor="eq-hours-photo">Photo of the motor hour counter</label>
      <div id="eq-hours-photo">
        <CameraCapture capturedPhoto={hourMeterPhoto} onCapture={setHourMeterPhoto} label="Take hour counter photo" />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 4px" }}>
        <input
          type="checkbox"
          checked={damaged}
          onChange={(e) => setDamaged(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <span style={{ fontWeight: 400, color: "var(--ink)", textTransform: "none", fontSize: "0.9rem" }}>
          Report damage
        </span>
      </label>

      {damaged && (
        <div>
          <label htmlFor="eq-damage-photo">Photo of the damage</label>
          <div id="eq-damage-photo">
            <CameraCapture capturedPhoto={damagePhoto} onCapture={setDamagePhoto} label="Take damage photo" />
          </div>

          <label htmlFor="eq-damage-notes">Note (optional)</label>
          <textarea
            id="eq-damage-notes"
            rows={2}
            value={damageNotes}
            onChange={(e) => setDamageNotes(e.target.value)}
            placeholder="Describe the damage"
          />
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary" onClick={submit} disabled={submitting || !canSubmit}>
        {submitting ? "Checking in…" : "Check in"}
      </button>
    </div>
  );
}
