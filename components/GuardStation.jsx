"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BrandHeader from "@/components/BrandHeader";
import AdminGuard from "@/components/AdminGuard";
import CameraCapture from "@/components/CameraCapture";
import VehicleMovementPanel from "@/components/VehicleMovementPanel";
import { authFetch } from "@/lib/apiFetch";
import { formatTimeInCompanyTimezone, formatInCompanyTimezone } from "@/lib/timezone";
import { FACILITIES } from "@/lib/facilities";

const POLL_MS = 5000; // "real time" here means polled every 5s - see README
                       // for why this app uses polling rather than websockets.

// The Security dashboard - item #8 of the IA overhaul: gate-focused,
// consolidating what used to be 5 separate tabs (Gate Approvals / Guard
// Form / Guard Log / Vehicle Requests / Vehicle Check In/Out) into a
// smaller, more direct set. "Gate Operations" is now the actionable home -
// visitors grouped Expected/At Gate/On Site/Completed (same grouping as
// the admin Visitors page) with approve/deny right on the At Gate rows, so
// deciding a walk-in is a 2-click action instead of a separate dashboard
// trip. Guard Form + Guard Log merge into one "Security Log" tab.
const TABS = [
  { key: "gate", label: "Gate Operations" },
  { key: "security-log", label: "Security Log" },
  { key: "vehicles", label: "Vehicle Requests" },
  { key: "movements", label: "Vehicle Movement" },
  { key: "equipment", label: "Equipment Log" },
];

const STAGES = [
  { key: "expected", label: "Expected", statuses: ["invited", "pre_registered", "requested"] },
  { key: "at_gate", label: "At Gate", statuses: ["gate_pending", "gate_approved"] },
  { key: "on_site", label: "On Site", statuses: ["checked_in"] },
  { key: "completed", label: "Completed", statuses: ["checked_out", "gate_denied"] },
];

const STATUS_LABEL = {
  invited: "Invited",
  pre_registered: "Pre-registered",
  requested: "Awaiting approval",
  gate_pending: "At gate",
  gate_approved: "Approved",
  checked_in: "On site",
  checked_out: "Checked out",
  gate_denied: "Denied",
};

const VEHICLE_STATUS_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
const VEHICLE_STATUS_BADGE_CLASS = { pending: "invited", approved: "checked_in", rejected: "gate_denied" };

const CAR_TYPES = ["sedan", "suv", "van", "semi-truck"];

function GuardStationInner({ initialFacility }) {
  const [facility, setFacility] = useState(initialFacility);
  const [tab, setTab] = useState("gate");
  const [stage, setStage] = useState("at_gate");

  const [gateVisitors, setGateVisitors] = useState([]);
  const [gateError, setGateError] = useState("");
  const [gateLoading, setGateLoading] = useState(true);
  const [gateAnnounce, setGateAnnounce] = useState("");
  const [gateBusyId, setGateBusyId] = useState(null);
  const prevGateCount = useRef(null);

  const [logs, setLogs] = useState([]);
  const [logsError, setLogsError] = useState("");
  const [logsLoading, setLogsLoading] = useState(true);
  const [logBusyId, setLogBusyId] = useState(null);
  const [showLogForm, setShowLogForm] = useState(false);

  const [vehicleRequests, setVehicleRequests] = useState([]);
  const [vehicleError, setVehicleError] = useState("");
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [vehicleAnnounce, setVehicleAnnounce] = useState("");
  const prevVehicleCount = useRef(null);

  const [equipmentLog, setEquipmentLog] = useState([]);
  const [equipmentLogError, setEquipmentLogError] = useState("");
  const [equipmentLogLoading, setEquipmentLogLoading] = useState(true);

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
        setGateAnnounce(`Gate updated - ${visitors.length} visitor${visitors.length === 1 ? "" : "s"} tracked now.`);
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
        setVehicleAnnounce(`Vehicle requests updated - ${requests.length} request${requests.length === 1 ? "" : "s"} now.`);
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

  const loadEquipmentLog = useCallback(async () => {
    try {
      const res = await authFetch(`/api/guard/equipment-log?facility=${facility.key}&view=history`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEquipmentLog(data.movements || []);
      setEquipmentLogError("");
    } catch (e) {
      setEquipmentLogError(e.message);
    } finally {
      setEquipmentLogLoading(false);
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
    setEquipmentLogLoading(true);
  }, [facility.key]);

  // Poll everything every 5s so entries from other guards, gate approvals
  // decided by email/admin, and vehicle request decisions all show up here
  // without a manual refresh.
  useEffect(() => {
    loadGate();
    loadLogs();
    loadVehicleRequests();
    loadEquipmentLog();
    const interval = setInterval(() => {
      loadGate();
      loadLogs();
      loadVehicleRequests();
      loadEquipmentLog();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [loadGate, loadLogs, loadVehicleRequests, loadEquipmentLog]);

  const decideGate = async (id, action) => {
    setGateBusyId(id);
    try {
      const res = await authFetch(`/api/admin/gate/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await loadGate();
    } catch (e) {
      setGateError(e.message);
    } finally {
      setGateBusyId(null);
    }
  };

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
      setShowLogForm(false);
      await loadLogs();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const checkOutLog = async (id) => {
    setLogBusyId(id);
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
      setLogBusyId(null);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const activeStage = STAGES.find((s) => s.key === stage) || STAGES[0];
  const stageVisitors = gateVisitors.filter((v) => activeStage.statuses.includes(v.status));
  const vehiclesOut = vehicleRequests.filter((r) => r.status === "approved" && !r.returned_at);

  return (
    <main className="kiosk-shell" style={{ alignItems: "center" }}>
      <div className="kiosk-header" style={{ maxWidth: 720 }}>
        <BrandHeader label="Security" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div style={{ maxWidth: 720, width: "100%", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
        <Link href="/recommendations" className="helper-text" style={{ marginTop: 0, textDecoration: "underline" }}>
          Suggest a feature
        </Link>
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
        <div className="admin-card" style={{ width: "100%", maxWidth: 720 }}>
          <h3 style={{ marginBottom: 4 }}>Gate Operations</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>Updates automatically every few seconds.</p>

          <div className="tabs" style={{ marginBottom: 16 }}>
            {STAGES.map((s) => {
              const count = gateVisitors.filter((v) => s.statuses.includes(v.status)).length;
              return (
                <button key={s.key} className={`tab ${stage === s.key ? "active" : ""}`} onClick={() => setStage(s.key)}>
                  {s.label} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          {gateError && <p className="error-text">{gateError}</p>}
          {gateLoading && <p className="helper-text">Loading…</p>}
          {!gateLoading && stageVisitors.length === 0 && (
            <p className="helper-text">Nobody in "{activeStage.label}" right now.</p>
          )}

          {!gateLoading && stageVisitors.length > 0 && (
            <div className="vtable-scroll">
              <table className="vtable">
                <thead>
                  <tr>
                    <th>Visitor</th>
                    <th>Purpose</th>
                    <th>Status</th>
                    {stage === "at_gate" && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {stageVisitors.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.full_name}</td>
                      <td>{v.purpose || "-"}</td>
                      <td>
                        <span className={`badge ${v.status}`}>{STATUS_LABEL[v.status] || v.status}</span>
                      </td>
                      {stage === "at_gate" && (
                        <td>
                          {v.status === "gate_pending" ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="btn-small" onClick={() => decideGate(v.id, "approve")} disabled={gateBusyId === v.id}>
                                {gateBusyId === v.id ? "…" : "Approve"}
                              </button>
                              <button className="btn-small" onClick={() => decideGate(v.id, "deny")} disabled={gateBusyId === v.id}>
                                Deny
                              </button>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ marginTop: 24, marginBottom: 4 }}>Vehicles Expected</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>Approved requests not yet returned - watch for these at the gate.</p>

          {vehicleError && <p className="error-text">{vehicleError}</p>}
          {vehicleLoading && <p className="helper-text">Loading…</p>}
          {!vehicleLoading && vehiclesOut.length === 0 && <p className="helper-text">No vehicles currently out.</p>}

          {!vehicleLoading && vehiclesOut.length > 0 && (
            <div className="vtable-scroll">
              <table className="vtable">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Vehicle</th>
                    <th>Destination</th>
                    <th>Needed</th>
                  </tr>
                </thead>
                <tbody>
                  {vehiclesOut.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.is_external ? r.customer_name : r.employee_name}</td>
                      <td>{r.is_external ? "External vehicle" : r.vehicle}</td>
                      <td>{r.destination}</td>
                      <td style={{ fontSize: "0.78rem" }}>
                        {r.needed_from
                          ? `${formatInCompanyTimezone(r.needed_from)} → ${formatInCompanyTimezone(r.needed_until)}`
                          : r.estimated_time || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "security-log" && (
        <div className="admin-card" style={{ width: "100%", maxWidth: 720 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <h3 style={{ marginBottom: 0 }}>Security Log</h3>
            <button className="btn-small" onClick={() => setShowLogForm((s) => !s)}>
              {showLogForm ? "Cancel" : "+ Log entry"}
            </button>
          </div>
          <p className="helper-text" style={{ marginBottom: 16 }}>Walk-in visitors and vehicles logged at the gate.</p>

          {showLogForm && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              {formSubmitted && (
                <p className="helper-text" style={{ color: "var(--accent-dark)", marginBottom: 12 }}>
                  ✓ Logged.
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
                      <td>{g.car_type || "-"}</td>
                      <td>{formatTimeInCompanyTimezone(g.checked_in_at)}</td>
                      <td>{g.checked_out_at ? formatTimeInCompanyTimezone(g.checked_out_at) : "-"}</td>
                      <td>
                        {!g.checked_out_at && (
                          <button className="btn-small" onClick={() => checkOutLog(g.id)} disabled={logBusyId === g.id}>
                            {logBusyId === g.id ? "…" : "Check out"}
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
        <div className="admin-card" style={{ width: "100%", maxWidth: 720 }}>
          <h3 style={{ marginBottom: 4 }}>Vehicle Requests</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>
            Check the status before releasing a vehicle.
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
                    <th>Needed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleRequests.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.is_external ? r.customer_name : r.employee_name}</td>
                      <td>{r.is_external ? "External vehicle" : r.vehicle}</td>
                      <td>{r.destination}</td>
                      <td style={{ fontSize: "0.78rem" }}>
                        {r.needed_from
                          ? `${formatInCompanyTimezone(r.needed_from)} → ${formatInCompanyTimezone(r.needed_until)}`
                          : r.estimated_time || "-"}
                      </td>
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

      {tab === "movements" && <VehicleMovementPanel facility={facility} />}

      {tab === "equipment" && (
        <div className="admin-card" style={{ width: "100%", maxWidth: 720 }}>
          <h3 style={{ marginBottom: 4 }}>Equipment Log</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>
            Read-only - entries come from staff scanning the QR code on each piece of equipment.
          </p>

          {equipmentLogError && <p className="error-text">{equipmentLogError}</p>}
          {equipmentLogLoading && <p className="helper-text">Loading…</p>}
          {!equipmentLogLoading && equipmentLog.length === 0 && <p className="helper-text">No equipment log entries yet.</p>}

          {!equipmentLogLoading && equipmentLog.length > 0 && (
            <div className="vtable-scroll">
              <table className="vtable">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>User</th>
                    <th>Out</th>
                    <th>In</th>
                    <th>Damage</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentLog.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.unit_name}</td>
                      <td>{m.user_name}</td>
                      <td style={{ fontSize: "0.8rem" }}>{formatInCompanyTimezone(m.checked_out_at)}</td>
                      <td style={{ fontSize: "0.8rem" }}>{m.checked_in_at ? formatInCompanyTimezone(m.checked_in_at) : "Still out"}</td>
                      <td>{m.damaged ? <span className="badge gate_denied">Reported</span> : "-"}</td>
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
