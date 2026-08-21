"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import ImageOptionGrid from "@/components/ImageOptionGrid";
import CameraCapture from "@/components/CameraCapture";
import { AVAILABLE_VEHICLES } from "@/lib/vehicles";
import { formatInCompanyTimezone } from "@/lib/timezone";

const SUBTABS = [
  { key: "checkout", label: "Check Out" },
  { key: "active", label: "Currently Out" },
  { key: "available", label: "Available" },
  { key: "history", label: "History" },
];

function durationOutside(checkedOutAt, checkedInAt) {
  const end = checkedInAt ? new Date(checkedInAt) : new Date();
  const ms = end - new Date(checkedOutAt);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function CheckInPanel({ movement, onDone, onCancel }) {
  const [notes, setNotes] = useState("");
  const [incident, setIncident] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await authFetch(`/api/guard/vehicle-movements/${movement.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkin_condition_notes: notes,
          checkin_photo: photo,
          incident_notes: incident,
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
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 16,
        marginTop: 10,
        background: "var(--paper)",
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 10 }}>
        Check in {movement.vehicle} — {movement.license_plate}
      </p>

      <label htmlFor="ci-notes">Vehicle condition notes</label>
      <textarea id="ci-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

      <label htmlFor="ci-incident">Damage or incident notes (optional)</label>
      <textarea id="ci-incident" rows={2} value={incident} onChange={(e) => setIncident(e.target.value)} />

      <label htmlFor="ci-photo">Photo of the vehicle</label>
      <div id="ci-photo">
        <CameraCapture capturedPhoto={photo} onCapture={setPhoto} label="Take check-in photo" />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn-small" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button className="btn-small" onClick={submit} disabled={submitting}>
          {submitting ? "Checking in…" : "Confirm check-in"}
        </button>
      </div>
    </div>
  );
}

export default function VehicleMovementPanel({ facility }) {
  const [subtab, setSubtab] = useState("checkout");
  const [outMap, setOutMap] = useState({});
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingInId, setCheckingInId] = useState(null);

  const [form, setForm] = useState({ vehicle: "", license_plate: "", driver_name: "", destination: "", checkout_condition_notes: "" });
  const [checkoutPhoto, setCheckoutPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [availRes, activeRes, historyRes] = await Promise.all([
        authFetch(`/api/guard/vehicle-movements/availability?facility=${facility.key}`),
        authFetch(`/api/guard/vehicle-movements?facility=${facility.key}&view=active`),
        authFetch(`/api/guard/vehicle-movements?facility=${facility.key}&view=history`),
      ]);
      const availData = await availRes.json();
      const activeData = await activeRes.json();
      const historyData = await historyRes.json();
      if (!availRes.ok) throw new Error(availData.error);
      if (!activeRes.ok) throw new Error(activeData.error);
      if (!historyRes.ok) throw new Error(historyData.error);
      setOutMap(availData.out || {});
      setActive(activeData.movements || []);
      setHistory(historyData.movements || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [facility.key]);

  useEffect(() => {
    load();
  }, [load]);

  const unavailableMessages = {};
  for (const [vehicle, info] of Object.entries(outMap)) {
    unavailableMessages[vehicle] = `${info.driver_name} is currently using this vehicle/equipment.`;
  }

  const submitCheckout = async () => {
    setSubmitting(true);
    setFormError("");
    try {
      const res = await authFetch("/api/guard/vehicle-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, checkout_photo: checkoutPhoto, facility: facility.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ vehicle: "", license_plate: "", driver_name: "", destination: "", checkout_condition_notes: "" });
      setCheckoutPhoto(null);
      setFormSubmitted(true);
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const availableVehicleNames = AVAILABLE_VEHICLES.filter((v) => !outMap[v.name]).map((v) => v.name);

  return (
    <div className="admin-card">
      <div className="tabs">
        {SUBTABS.map((t) => (
          <button key={t.key} className={`tab ${subtab === t.key ? "active" : ""}`} onClick={() => setSubtab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}

      {!loading && subtab === "checkout" && (
        <div>
          <h3 style={{ marginBottom: 4 }}>Check out a vehicle</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>Record a vehicle leaving the premises.</p>

          {formSubmitted && (
            <p className="helper-text" style={{ color: "var(--accent-dark)", marginBottom: 12 }}>
              ✓ Checked out.
            </p>
          )}

          <label>Vehicle</label>
          <ImageOptionGrid
            items={AVAILABLE_VEHICLES}
            selected={form.vehicle}
            onChange={(vehicle) => setForm({ ...form, vehicle })}
            unavailable={unavailableMessages}
          />

          <label htmlFor="co-plate">License plate number</label>
          <input id="co-plate" type="text" value={form.license_plate} onChange={set("license_plate")} placeholder="Enter the license plate number" />

          <label htmlFor="co-driver">Driver's name</label>
          <input id="co-driver" type="text" value={form.driver_name} onChange={set("driver_name")} placeholder="Enter driver's full name" />

          <label htmlFor="co-destination">Customer or destination (if applicable)</label>
          <input id="co-destination" type="text" value={form.destination} onChange={set("destination")} />

          <label htmlFor="co-notes">Vehicle condition notes</label>
          <textarea id="co-notes" rows={2} value={form.checkout_condition_notes} onChange={set("checkout_condition_notes")} />

          <label htmlFor="co-photo">Photo of the vehicle</label>
          <div id="co-photo">
            <CameraCapture capturedPhoto={checkoutPhoto} onCapture={setCheckoutPhoto} label="Take check-out photo" />
          </div>

          {formError && <p className="error-text">{formError}</p>}

          <button
            className="btn btn-primary"
            onClick={submitCheckout}
            disabled={submitting || !form.vehicle || !form.license_plate.trim() || !form.driver_name.trim()}
          >
            {submitting ? "Checking out…" : "Check out vehicle"}
          </button>
        </div>
      )}

      {!loading && subtab === "active" && (
        <div>
          <h3 style={{ marginBottom: 4 }}>Currently checked out</h3>
          {active.length === 0 && <p className="helper-text">No vehicles are currently checked out.</p>}
          {active.map((m) => (
            <div key={m.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{m.vehicle} — {m.license_plate}</div>
                  <div className="helper-text" style={{ marginTop: 0 }}>
                    Driver: {m.driver_name}{m.destination ? ` · ${m.destination}` : ""}
                  </div>
                  <div className="helper-text" style={{ marginTop: 0 }}>
                    Out since {formatInCompanyTimezone(m.checked_out_at)} ({durationOutside(m.checked_out_at, null)} so far)
                  </div>
                </div>
                {checkingInId !== m.id && (
                  <button className="btn-small" onClick={() => setCheckingInId(m.id)}>
                    Check in
                  </button>
                )}
              </div>
              {checkingInId === m.id && (
                <CheckInPanel
                  movement={m}
                  onCancel={() => setCheckingInId(null)}
                  onDone={() => {
                    setCheckingInId(null);
                    load();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && subtab === "available" && (
        <div>
          <h3 style={{ marginBottom: 4 }}>Available vehicles</h3>
          {availableVehicleNames.length === 0 && <p className="helper-text">No vehicles currently available.</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {availableVehicleNames.map((name) => (
              <span key={name} className="badge checked_in">{name}</span>
            ))}
          </div>
        </div>
      )}

      {!loading && subtab === "history" && (
        <div>
          <h3 style={{ marginBottom: 4 }}>Vehicle movement history</h3>
          {history.length === 0 && <p className="helper-text">No movements recorded yet.</p>}
          {history.length > 0 && (
            <div className="vtable-scroll">
              <table className="vtable">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Plate</th>
                    <th>Driver</th>
                    <th>Out</th>
                    <th>In</th>
                    <th>Duration</th>
                    <th>Guard(s)</th>
                    <th>Photos</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((m) => (
                    <tr key={m.id}>
                      <td>{m.vehicle}</td>
                      <td style={{ fontWeight: 600 }}>{m.license_plate}</td>
                      <td>{m.driver_name}</td>
                      <td style={{ fontSize: "0.8rem" }}>{formatInCompanyTimezone(m.checked_out_at)}</td>
                      <td style={{ fontSize: "0.8rem" }}>{m.checked_in_at ? formatInCompanyTimezone(m.checked_in_at) : "Still out"}</td>
                      <td>{durationOutside(m.checked_out_at, m.checked_in_at)}</td>
                      <td style={{ fontSize: "0.78rem" }}>
                        {m.checked_out_by}{m.checked_in_by ? ` / ${m.checked_in_by}` : ""}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {m.checkout_photo_signed_url && (
                            <a href={m.checkout_photo_signed_url} target="_blank" rel="noreferrer">Out</a>
                          )}
                          {m.checkin_photo_signed_url && (
                            <a href={m.checkin_photo_signed_url} target="_blank" rel="noreferrer">In</a>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.78rem", maxWidth: 160 }}>
                        {[m.checkout_condition_notes, m.checkin_condition_notes, m.incident_notes].filter(Boolean).join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
