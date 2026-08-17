"use client";

import { useCallback, useEffect, useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import AdminGuard from "@/components/AdminGuard";
import CameraCapture from "@/components/CameraCapture";
import { authFetch } from "@/lib/apiFetch";
import { formatTimeInCompanyTimezone } from "@/lib/timezone";

const POLL_MS = 5000; // "real time" here means polled every 5s — see README
                       // for why this app uses polling rather than websockets.

const GATE_STATUS_LABEL = {
  gate_pending: "Awaiting approval",
  gate_approved: "Approved",
  gate_denied: "Denied",
};

const CAR_TYPES = ["sedan", "suv", "van", "semi-truck"];

function GuardStationInner({ facility }) {
  const [tab, setTab] = useState("gate"); // "gate" | "log"

  const [gateVisitors, setGateVisitors] = useState([]);
  const [gateError, setGateError] = useState("");
  const [gateLoading, setGateLoading] = useState(true);

  const [logs, setLogs] = useState([]);
  const [logsError, setLogsError] = useState("");
  const [logsLoading, setLogsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [form, setForm] = useState({ visitor_name: "", phone: "", company: "", car_type: "" });
  const [platePhoto, setPlatePhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadGate = useCallback(async () => {
    try {
      const res = await authFetch(
        `/api/guard/gate-status?facility=${facility.key}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGateVisitors(data.visitors || []);
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

  // Poll both every 5s so entries logged by other guards, or gate approvals
  // decided by email/admin, show up here without a manual refresh.
  useEffect(() => {
    loadGate();
    loadLogs();
    const interval = setInterval(() => {
      loadGate();
      loadLogs();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [loadGate, loadLogs]);

  const submitLog = async () => {
    setSubmitting(true);
    setFormError("");
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

      <div className="tabs" style={{ maxWidth: 720, width: "100%" }}>
        <button className={`tab ${tab === "gate" ? "active" : ""}`} onClick={() => setTab("gate")}>
          Gate Approvals
        </button>
        <button className={`tab ${tab === "log" ? "active" : ""}`} onClick={() => setTab("log")}>
          Vehicle Log
        </button>
      </div>

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

      {tab === "log" && (
        <div className="admin-card">
          <h3 style={{ marginBottom: 16 }}>Log a vehicle / visitor</h3>

          <label>Visitor name</label>
          <input type="text" value={form.visitor_name} onChange={set("visitor_name")} placeholder="Jane Cooper" />

          <div className="row-2">
            <div>
              <label>Phone number</label>
              <input type="tel" value={form.phone} onChange={set("phone")} />
            </div>
            <div>
              <label>Company</label>
              <input type="text" value={form.company} onChange={set("company")} />
            </div>
          </div>

          <label>Car type</label>
          <select value={form.car_type} onChange={set("car_type")}>
            <option value="">Select…</option>
            {CAR_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>

          <label>Vehicle plate photo</label>
          <CameraCapture capturedPhoto={platePhoto} onCapture={setPlatePhoto} label="Take plate photo" />

          {formError && <p className="error-text">{formError}</p>}

          <button
            className="btn btn-primary"
            onClick={submitLog}
            disabled={submitting || !form.visitor_name.trim()}
          >
            {submitting ? "Logging…" : "Log entry"}
          </button>

          <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid var(--line)" }} />

          <h3 style={{ marginBottom: 4 }}>Today's log</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>Updates automatically every few seconds.</p>

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
    </main>
  );
}

export default function GuardStation({ facility }) {
  return (
    <AdminGuard requiredRole="staff">
      <GuardStationInner facility={facility} />
    </AdminGuard>
  );
}
