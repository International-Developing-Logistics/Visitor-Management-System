"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import AdminGuard from "@/components/AdminGuard";
import CameraCapture from "@/components/CameraCapture";
import { authFetch } from "@/lib/apiFetch";
import { formatTimeInCompanyTimezone } from "@/lib/timezone";
import { FACILITIES } from "@/lib/facilities";

const POLL_MS = 5000; // "real time" here means polled every 5s — see README
                       // for why this app uses polling rather than websockets.

const GATE_STATUS_LABEL = {
  gate_pending: "Awaiting approval",
  gate_approved: "Approved",
  gate_denied: "Denied",
};

const VEHICLE_STATUS_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
const VEHICLE_STATUS_BADGE_CLASS = { pending: "invited", approved: "checked_in", rejected: "gate_denied" };

const CAR_TYPES = ["sedan", "suv", "van", "semi-truck"];

const TABS = [
  { key: "gate", label: "Gate Approvals" },
  { key: "form", label: "Guard Form" },
  { key: "log", label: "Guard Log" },
  { key: "vehicles", label: "Vehicle Requests" },
];

function GuardStationInner({ initialFacility }) {
  const [facility, setFacility] = useState(initialFacility);
  const [tab, setTab] = useState("gate");

  const [gateVisitors, setGateVisitors] = useState([]);
  const [gateError, setGateError] = useState("");
  const [gateLoading, setGateLoading] = useState(true);
  const [gateAnnounce, setGateAnnounce] = useState("");
  const prevGateCount = useRef(null);

  const [logs, setLogs] = useState([]);
  const [logsError, setLogsError] = useState("");
  const [logsLoading, setLogsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [vehicleRequests, setVehicleRequests] = useState([]);
  const [vehicleError, setVehicleError] = useState("");
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [vehicleAnnounce, setVehicleAnnounce] = useState("");
  const prevVehicleCount = useRef(null);

  const [form, setForm] = useState({ visitor_name: "", phone: "", company: "", car_type: "" });
  const [platePhoto, setPlatePhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);

  const loadGate = useCallback(async () => {
    try {
      const res = await authFetch(`/api/guard/gate-status?facility=${facility.key}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const visitors = data.visitors || [];
      if (prevGateCount.current !== null && visitors.length !== prevGateCount.current) {
        setGateAnnounce(`Gate approvals updated — ${visitors.length} request${visitors.length === 1 ? "" : "s"} now.`);
      }
      prevGateCount.current = visitors.length;
      setGateVisitors(visitors);
      setGateError("");
    } catch (e) {
      setGateError(e.message);
    } finally {
      setGateLoading(false);
    }
  }, [facility.key]);

  const loadLogs = useCallback(async () => {
    try {
      const res = await authFetch(`/api/guard-logs?facility=${facility.key}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLogs(data.logs || []);
      setLogsError("");
    } catch (e) {
      setLogsError(e.message);
    } finally {
      setLogsLoading(false);
    }
  }, [facility.key]);

  const loadVehicleRequests = useCallback(async () => {
    try {
      const res = await authFetch(`/api/guard/vehicle-requests?facility=${facility.key}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const requests = data.requests || [];
      if (prevVehicleCount.current !== null && requests.length !== prevVehicleCount.current) {
        setVehicleAnnounce(`Vehicle requests updated — ${requests.length} request${requests.length === 1 ? "" : "s"} now.`);
      }
      prevVehicleCount.current = requests.length;
      setVehicleRequests(requests);
      setVehicleError("");
    } catch (e) {
      setVehicleError(e.message);
    } finally {
      setVehicleLoading(false);
    }
  }, [facility.key]);

  // Reset the "has this loaded before" trackers when switching facility, so
  // we don't announce a bogus "updated" the moment the new facility's first
  // load comes in.
  useEffect(() => {
    prevGateCount.current = null;
    prevVehicleCount.current = null;
    setGateLoading(true);
    setLogsLoading(true);
    setVehicleLoading(true);
  }, [facility.key]);

  // Poll everything every 5s so entries from other guards, gate approvals
  // decided by email/admin, and vehicle request decisions all show up here
  // without a manual refresh.
  useEffect(() => {
    loadGate();
    loadLogs();
    loadVehicleRequests();
    const interval = setInterval(() => {
      loadGate();
      loadLogs();
      loadVehicleRequests();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [loadGate, loadLogs, loadVehicleRequests]);

  const submitLog = async () => {
    setSubmitting(true);
    setFormError("");
    setFormSubmitted(false);
    try {
      const res = await authFetch("/api/guard-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, vehicle_plate_photo: platePhoto, facility: facility.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ visitor_name: "", phone: "", company: "", car_type: "" });
      setPlatePhoto(null);
      setFormSubmitted(true);
      await loadLogs();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const checkOutLog = async (id) => {
    setBusyId(id);
    try {
      const res = await authFetch(`/api/guard-logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await loadLogs();
    } catch (e) {
      setLogsError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <main className="kiosk-shell" style={{ alignItems: "center" }}>
      <div className="kiosk-header" style={{ maxWidth: 720 }}>
        <BrandHeader label="Security" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div style={{ maxWidth: 720, width: "100%", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <span className="helper-text" style={{ marginTop: 0 }}>Facility:</span>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.values(FACILITIES).map((f) => (
            <button
              key={f.key}
              className={`tab ${facility.key === f.key ? "active" : ""}`}
              onClick={() => setFacility(f)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tabs" style={{ maxWidth: 720, width: "100%" }}>
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="sr-only">{gateAnnounce}</div>
      <div aria-live="polite" className="sr-only">{vehicleAnnounce}</div>

      {tab === "gate" && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 4 }}>Gate approvals</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>Updates automatically every few seconds.</p>

          {gateError && <p className="error-text">{gateError}</p>}
          {gateLoading && <p className="helper-text">Loading…</p>}
          {!gateLoading && gateVisitors.length === 0 && <p className="helper-text">No gate requests right now.</p>}

          {!gateLoading && gateVisitors.length > 0 && (
            <div className="vtable-scroll">
              <table className="vtable">
                <thead>
                  <tr>
                    <th>Visitor</th>
                    <th>Purpose</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gateVisitors.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.full_name}</td>
                      <td>{v.purpose}</td>
                      <td>
                        <span className={`badge ${v.status}`}>{GATE_STATUS_LABEL[v.status] || v.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "form" && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 4 }}>Log a vehicle / visitor</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>
            Submit a new entry here. See the <strong>Guard Log</strong> tab to view and check out existing entries.
          </p>

          {formSubmitted && (
            <p className="helper-text" style={{ color: "var(--accent-dark)", marginBottom: 12 }}>
              ✓ Logged. Switch to the Guard Log tab to see it, or log another entry below.
            </p>
          )}

          <label htmlFor="gf-name">Visitor name</label>
          <input id="gf-name" type="text" value={form.visitor_name} onChange={set("visitor_name")} placeholder="Enter visitor's full name" />

          <div className="row-2">
            <div>
              <label htmlFor="gf-phone">Phone number</label>
              <input id="gf-phone" type="tel" value={form.phone} onChange={set("phone")} />
            </div>
            <div>
              <label htmlFor="gf-company">Company</label>
              <input id="gf-company" type="text" value={form.company} onChange={set("company")} />
            </div>
          </div>

          <label htmlFor="gf-car-type">Car type</label>
          <select id="gf-car-type" value={form.car_type} onChange={set("car_type")}>
            <option value="">Select…</option>
            {CAR_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>

          <label htmlFor="gf-plate">Vehicle plate photo</label>
          <div id="gf-plate">
            <CameraCapture capturedPhoto={platePhoto} onCapture={setPlatePhoto} label="Take plate photo" />
          </div>

          {formError && <p className="error-text">{formError}</p>}

          <button
            className="btn btn-primary"
            onClick={submitLog}
            disabled={submitting || !form.visitor_name.trim()}
          >
            {submitting ? "Logging…" : "Log entry"}
          </button>
        </div>
      )}

      {tab === "log" && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 4 }}>Guard log</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>
            Updates automatically every few seconds. Use the <strong>Guard Form</strong> tab to log a new entry.
          </p>

          {logsError && <p className="error-text">{logsError}</p>}
          {logsLoading && <p className="helper-text">Loading…</p>}
          {!logsLoading && logs.length === 0 && <p className="helper-text">No entries logged yet.</p>}

          {!logsLoading && logs.length > 0 && (
            <div className="vtable-scroll">
              <table className="vtable">
                <thead>
                  <tr>
                    <th></th>
                    <th>Visitor</th>
                    <th>Car</th>
                    <th>In</th>
                    <th>Out</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((g) => (
                    <tr key={g.id}>
                      <td>
                        {g.vehicle_plate_photo_signed_url ? (
                          <img
                            src={g.vehicle_plate_photo_signed_url}
                            alt="Plate"
                            style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }}
                          />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--line)" }} />
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{g.visitor_name}</div>
                        <div className="helper-text" style={{ marginTop: 0 }}>
                          {[g.company, g.phone].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td>{g.car_type || "—"}</td>
                      <td>{formatTimeInCompanyTimezone(g.checked_in_at)}</td>
                      <td>{g.checked_out_at ? formatTimeInCompanyTimezone(g.checked_out_at) : "—"}</td>
                      <td>
                        {!g.checked_out_at && (
                          <button className="btn-small" onClick={() => checkOutLog(g.id)} disabled={busyId === g.id}>
                            {busyId === g.id ? "…" : "Check out"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "vehicles" && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 4 }}>Vehicle requests</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>
            Check the status before releasing a vehicle. Updates automatically every few seconds.
          </p>

          {vehicleError && <p className="error-text">{vehicleError}</p>}
          {vehicleLoading && <p className="helper-text">Loading…</p>}
          {!vehicleLoading && vehicleRequests.length === 0 && <p className="helper-text">No vehicle requests yet.</p>}

          {!vehicleLoading && vehicleRequests.length > 0 && (
            <div className="vtable-scroll">
              <table className="vtable">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Vehicle</th>
                    <th>Destination</th>
                    <th>Est. time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleRequests.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.employee_name}</td>
                      <td>{r.vehicle}</td>
                      <td>{r.destination}</td>
                      <td>{r.estimated_time || "—"}</td>
                      <td>
                        <span className={`badge ${VEHICLE_STATUS_BADGE_CLASS[r.status]}`}>
                          {VEHICLE_STATUS_LABEL[r.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function GuardStation({ facility }) {
  return (
    <AdminGuard requiredRole="staff">
      <GuardStationInner initialFacility={facility} />
    </AdminGuard>
  );
}
