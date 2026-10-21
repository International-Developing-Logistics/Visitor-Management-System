"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { useFacility, ALL_FACILITIES } from "@/lib/facilityContext";
import { getFacility } from "@/lib/facilities";

const DECISION_CLASS = { Accept: "decision-accept", Hold: "decision-hold", Reject: "decision-reject" };

export default function AdminGateCheckFormsPage() {
  const { facility } = useFacility();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/gate-check-forms?facility=${facility}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForms(data.forms || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [facility]);

  useEffect(() => {
    load();
  }, [load]);

  // "All Facilities" has no single submission page to link to - default
  // the New button to Harmony's in that case, same fallback getFacility()
  // itself uses for an unrecognized key.
  const submitFacility = getFacility(facility === ALL_FACILITIES ? undefined : facility);
  const newHref = submitFacility.key === "idl" ? "/idl/gate-check-form" : "/gate-check-form";

  return (
    <div className="admin-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>Gate Check Forms</h3>
        <Link href={newHref} className="btn-small" target="_blank" rel="noreferrer">+ New Gate Check</Link>
      </div>
      <p className="helper-text" style={{ marginBottom: 16 }}>
        Container receiving security checks, submitted by admin and guard accounts.
      </p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && forms.length === 0 && <p className="helper-text">No gate check forms yet.</p>}

      {!loading && forms.length > 0 && (
        <div className="vtable-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th>Form No.</th>
                <th>Date</th>
                <th>Container</th>
                <th>Truck Plate</th>
                <th>Driver</th>
                <th>Decision</th>
                <th>Submitted By</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>
                    <Link href={`/admin/gate-check-forms/${f.id}`}>{f.form_no}</Link>
                  </td>
                  <td>{f.check_date || "—"}</td>
                  <td style={{ fontFamily: "monospace" }}>{f.container_no || "—"}</td>
                  <td style={{ fontFamily: "monospace" }}>{f.truck_plate || "—"}</td>
                  <td>{f.driver_name || "—"}</td>
                  <td>
                    {f.decision ? (
                      <span className={`badge ${DECISION_CLASS[f.decision]}`}>{f.decision}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>{f.submitted_by_email || "—"}</td>
                  <td style={{ fontSize: "0.8rem" }}>{formatInCompanyTimezone(f.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
