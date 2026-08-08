"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import BrandHeader from "@/components/BrandHeader";

const STATUS_COPY = {
  pending: { label: "Pending activation", tone: "invited" },
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
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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
  const passUrl = origin ? `${origin}/contractor-pass?token=${token}` : "";
  const qrSrc = passUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(passUrl)}`
    : "";

  return (
    <div style={{ textAlign: "center" }}>
      <h2 style={{ marginBottom: 4 }}>{pass.full_name}</h2>
      <p style={{ marginBottom: 20 }}>
        <span className={`badge ${status.tone}`}>{status.label}</span>
      </p>

      {qrSrc && (
        <img src={qrSrc} alt="Contractor pass QR code" width={160} height={160} style={{ margin: "0 auto 20px" }} />
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", textAlign: "left" }}>
        <tbody>
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
          Your pass is awaiting activation. Check back after registration is reviewed.
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
