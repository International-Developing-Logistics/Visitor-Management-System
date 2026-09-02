"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import BrandHeader from "@/components/BrandHeader";

const STATUS_COPY = {
  pending: { label: "Pending review", tone: "gate_pending" },
  denied: { label: "Denied", tone: "gate_denied" },
  active: { label: "Active", tone: "checked_in" },
  inactive: { label: "Inactive", tone: "checked_out" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function PassInner() {
  const token = useSearchParams().get("token");
  const [pass, setPass] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("This link is missing a token.");
      setLoading(false);
      return;
    }
    fetch(`/api/contractors/pass?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setPass(d.pass);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="helper-text">Loading…</p>;
  if (error) return <p className="error-text">{error}</p>;

  const status = STATUS_COPY[pass.status] || { label: pass.status, tone: "invited" };

  return (
    <div style={{ textAlign: "center" }}>
      <h2 style={{ marginBottom: 4 }}>{pass.full_name}</h2>
      {pass.company && (
        <p className="helper-text" style={{ marginTop: 0, marginBottom: 12 }}>{pass.company}</p>
      )}
      <p style={{ marginBottom: 20 }}>
        <span className={`badge ${status.tone}`}>{status.label}</span>
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", textAlign: "left" }}>
        <tbody>
          <tr>
            <td style={{ color: "var(--muted)", padding: "6px 0" }}>Pass ID</td>
            <td style={{ padding: "6px 0" }}>{pass.pass_id || "—"}</td>
          </tr>
          <tr>
            <td style={{ color: "var(--muted)", padding: "6px 0" }}>Valid from</td>
            <td style={{ padding: "6px 0" }}>{fmtDate(pass.validity_start)}</td>
          </tr>
          <tr>
            <td style={{ color: "var(--muted)", padding: "6px 0" }}>Valid until</td>
            <td style={{ padding: "6px 0" }}>{fmtDate(pass.validity_end)}</td>
          </tr>
        </tbody>
      </table>

      {pass.status === "pending" && (
        <p className="helper-text" style={{ marginTop: 16 }}>
          Your registration is awaiting review. Check back after it's been decided.
        </p>
      )}
      {pass.status === "denied" && (
        <p className="helper-text" style={{ marginTop: 16 }}>
          Your registration was not approved. Contact your point of contact if you have questions.
        </p>
      )}
    </div>
  );
}

export default function ContractorPassPage() {
  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Contractor pass" />
      </div>
      <div className="card">
        <Suspense fallback={<p className="helper-text">Loading…</p>}>
          <PassInner />
        </Suspense>
      </div>
    </main>
  );
}
