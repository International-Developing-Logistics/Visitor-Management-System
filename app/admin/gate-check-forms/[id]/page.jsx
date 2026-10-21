"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { SECTIONS, SIGN_ROLES, PHOTO_SLOTS } from "@/components/GateCheckForm";

const DECISION_CLASS = { Accept: "decision-accept", Hold: "decision-hold", Reject: "decision-reject" };

function fmtLocal(iso) {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : iso;
}
function fmtGps(g) {
  if (!g) return "Not available";
  return `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)} (${g.source})`;
}

export default function GateCheckFormDetailPage() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await authFetch(`/api/admin/gate-check-forms/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (active) setForm(data.form);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="admin-card"><p className="helper-text">Loading…</p></div>;
  if (error) return <div className="admin-card"><p className="error-text">{error}</p></div>;
  if (!form) return null;

  const fields = form.fields || {};

  return (
    <div className="admin-card print-area">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Gate Check Form {form.form_no}</h3>
        <button className="btn-small" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div>
          <h3 style={{ margin: 0 }}>Container Receiving – Security Gate Check Form</h3>
          <p className="helper-text" style={{ marginTop: 4 }}>
            Form No. {form.form_no} · {form.facility} · Submitted by {form.submitted_by_email || "—"} on {formatInCompanyTimezone(form.created_at)}
          </p>
        </div>
        {form.decision && <span className={`badge ${DECISION_CLASS[form.decision]}`} style={{ fontSize: "0.9rem" }}>{form.decision}</span>}
      </div>

      {SECTIONS.map(([title, flds], i) => (
        <section key={title} style={{ marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
            {String(i + 1).padStart(2, "0")} · {title}
          </h4>
          <div className="vtable-scroll">
            <table className="vtable">
              <tbody>
                {flds.map((f) => (
                  <tr key={f.key}>
                    <td style={{ width: "40%", color: "var(--muted)", fontSize: "0.82rem" }}>{f.label}</td>
                    <td style={{ fontFamily: f.mono ? "monospace" : undefined, whiteSpace: "pre-wrap" }}>{fields[f.key] || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section style={{ marginBottom: 20 }}>
        <h4 style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
          12 · Sign-off
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {SIGN_ROLES.map(([role, label]) => {
            const s = form.signatures?.[role];
            return (
              <div key={role} className="card" style={{ padding: 14, margin: 0 }}>
                <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "0.9rem" }}>{label}</p>
                <p className="helper-text" style={{ margin: "0 0 6px" }}>{s?.name || "—"}{s?.time ? ` · ${formatInCompanyTimezone(s.time)}` : ""}</p>
                {s?.signed_url ? (
                  <img src={s.signed_url} alt={`${label} signature`} style={{ maxWidth: "100%", height: 60, objectFit: "contain", border: "1px solid var(--line)", borderRadius: 6, background: "#fff" }} />
                ) : (
                  <div style={{ height: 60, border: "1px dashed var(--line)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="helper-text" style={{ margin: 0 }}>Not signed</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="helper-text" style={{ marginTop: 14, marginBottom: 6 }}>Company Stamp</p>
        {form.stamp_signed_url ? (
          <img src={form.stamp_signed_url} alt="Company stamp" style={{ height: 100, border: "1px solid var(--line)", borderRadius: 6 }} />
        ) : (
          <p className="helper-text">No stamp photo attached.</p>
        )}
      </section>

      {form.signatures?.receipt && (
        <section style={{ marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
            Receipt Acknowledgment
          </h4>
          <p className="helper-text" style={{ margin: "0 0 6px" }}>
            {form.signatures.receipt.acknowledged ? "Acknowledged" : "Not acknowledged"} by {form.signatures.receipt.name || "—"}
          </p>
          {form.signatures.receipt.signed_url && (
            <img src={form.signatures.receipt.signed_url} alt="Receipt signature" style={{ height: 50, border: "1px solid var(--line)", borderRadius: 6, background: "#fff" }} />
          )}
        </section>
      )}

      {(form.fields?.rcvLocation || form.fields?.rcvTime || form.fields?.shipmentRef || form.fields?.carrierName || form.fields?.conditionNotes || (form.photos || []).some((p) => p.signed_url)) && (
        <section>
          <h4 style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
            13 · Receiving Evidence &amp; Photo Appendix
          </h4>
          <p className="helper-text" style={{ marginBottom: 10 }}>
            {fields.rcvLocation || "—"} · {fmtLocal(fields.rcvTime)} · Ref {fields.shipmentRef || "—"} · Carrier {fields.carrierName || "—"}
          </p>
          {fields.conditionNotes && <p style={{ whiteSpace: "pre-wrap", marginBottom: 14 }}>{fields.conditionNotes}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {PHOTO_SLOTS.map(([code, label]) => {
              const p = (form.photos || []).find((x) => x.field === code);
              return (
                <div key={code} className="card" style={{ padding: 10, margin: 0 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "0.85rem" }}>{label}</p>
                  {p?.signed_url ? (
                    <>
                      <img src={p.signed_url} alt={label} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 6 }} />
                      <p className="helper-text" style={{ marginTop: 6 }}>
                        Taken {fmtLocal(p.taken_at)} ({p.taken_source}) · GPS {fmtGps(p.gps)}
                      </p>
                    </>
                  ) : (
                    <div style={{ aspectRatio: "4 / 3", border: "1px dashed var(--line)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span className="helper-text" style={{ margin: 0 }}>Not captured</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
