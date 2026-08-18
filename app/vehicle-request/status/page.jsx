"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import BrandHeader from "@/components/BrandHeader";

const STATUS_COPY = {
  pending: { label: "Pending review", tone: "invited" },
  approved: { label: "Approved", tone: "checked_in" },
  rejected: { label: "Rejected", tone: "gate_denied" },
};

function StatusInner() {
  const token = useSearchParams().get("token");
  const [request, setRequest] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("This link is missing a token.");
      setLoading(false);
      return;
    }
    fetch(`/api/vehicle-requests/status?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setRequest(d.request);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="helper-text">Loading…</p>;
  if (error) return <p className="error-text">{error}</p>;

  const status = STATUS_COPY[request.status] || { label: request.status, tone: "invited" };

  return (
    <div style={{ textAlign: "center" }}>
      <h2 style={{ marginBottom: 4 }}>{request.employee_name}</h2>
      <p style={{ marginBottom: 20 }}>
        <span className={`badge ${status.tone}`}>{status.label}</span>
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", textAlign: "left" }}>
        <tbody>
          <tr>
            <td style={{ color: "var(--muted)", padding: "6px 0", width: 130 }}>Vehicle</td>
            <td style={{ padding: "6px 0" }}>{request.vehicle}</td>
          </tr>
          <tr>
            <td style={{ color: "var(--muted)", padding: "6px 0" }}>Destination</td>
            <td style={{ padding: "6px 0" }}>{request.destination}</td>
          </tr>
          <tr>
            <td style={{ color: "var(--muted)", padding: "6px 0" }}>Estimated time</td>
            <td style={{ padding: "6px 0" }}>{request.estimated_time || "—"}</td>
          </tr>
        </tbody>
      </table>
      {request.status === "pending" && (
        <p className="helper-text" style={{ marginTop: 16 }}>
          Transport coordinators have been notified — check back for a decision.
        </p>
      )}
    </div>
  );
}

export default function VehicleRequestStatusPage() {
  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Vehicle request status" />
      </div>
      <div className="card">
        <Suspense fallback={<p className="helper-text">Loading…</p>}>
          <StatusInner />
        </Suspense>
      </div>
    </main>
  );
}
