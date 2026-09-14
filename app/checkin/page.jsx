"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import BrandHeader from "@/components/BrandHeader";
import TimeSlotChooser from "@/components/TimeSlotChooser";
import ProposeTimeForm from "@/components/ProposeTimeForm";
import { STRUCTURED_GROUP_VISITOR_TYPE } from "@/lib/visitorTypes";
import { VISITOR_AGREEMENT_TEXT } from "@/lib/agreementText";

function emptyMember() {
  return { name: "", phone: "" };
}

function CheckinInner() {
  const token = useSearchParams().get("token");
  const [loading, setLoading] = useState(true);
  const [visitor, setVisitor] = useState(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("details"); // details -> ready/arrived
  const [values, setValues] = useState({
    full_name: "",
    phone: "",
    company: "",
    is_group: false,
    additional_visitor_count: "",
    additional_visitor_names: "",
    group_members: [],
    selected_time_slot: "",
    proposed_alternative_time: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Visitor type was already picked when this pre-registration was
  // created (by the guest themselves via open pre-registration, or by
  // staff via the invite tools) — it's not re-asked here, but it decides
  // whether "bringing others" collects a structured name+phone list.
  const isStructuredType = visitor?.visitor_type === STRUCTURED_GROUP_VISITOR_TYPE;

  useEffect(() => {
    if (!token) {
      setError("This link is missing a token. Please use the link from your email.");
      setLoading(false);
      return;
    }
    fetch(`/api/checkin?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setVisitor(d.visitor);
        const groupCount = d.visitor.additional_visitor_count || 0;
        setValues({
          full_name: d.visitor.full_name || "",
          phone: d.visitor.phone || "",
          company: d.visitor.company || "",
          is_group: groupCount > 0,
          additional_visitor_count: groupCount > 0 ? String(groupCount) : "",
          additional_visitor_names: d.visitor.additional_visitor_names || "",
          group_members: d.visitor.group_members?.length ? d.visitor.group_members : [],
          selected_time_slot: d.visitor.selected_time_slot || "",
          proposed_alternative_time: d.visitor.proposed_alternative_time || "",
        });
        if (d.visitor.status === "checked_in") setStage("arrived");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const updateMember = (index, field, value) => {
    const next = values.group_members.map((m, i) => (i === index ? { ...m, [field]: value } : m));
    setValues({ ...values, group_members: next });
  };
  const addMember = () => setValues({ ...values, group_members: [...values.group_members, emptyMember()] });
  const removeMember = (index) => setValues({ ...values, group_members: values.group_members.filter((_, i) => i !== index) });

  const completePreregistration = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/preregister/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          full_name: values.full_name,
          phone: values.phone,
          company: values.company,
          additional_visitor_count: values.is_group ? values.additional_visitor_count : 0,
          additional_visitor_names: values.is_group && !isStructuredType ? values.additional_visitor_names : "",
          group_members: values.is_group && isStructuredType ? values.group_members : [],
          selected_time_slot: values.selected_time_slot || null,
          proposed_alternative_time: values.proposed_alternative_time || null,
          agreed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVisitor(data.visitor);
      setStage("ready"); // pre-registration done, not yet arrived
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmArrival = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVisitor(data.visitor);
      setStage("arrived");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="helper-text">Loading…</p>;
  if (error) return <p className="error-text">{error}</p>;

  // Visitor already completed pre-reg earlier and is now arriving.
  if (visitor?.status === "pre_registered" && stage !== "ready") {
    return (
      <div className="confirm-wrap">
        <h2>Welcome back, {visitor.full_name}</h2>
        <p className="helper-text" style={{ marginBottom: 24 }}>
          You're pre-registered to see {visitor.hosts?.name || "your host"}. Tap below to let them know you've arrived.
        </p>
        <button className="btn btn-primary" onClick={confirmArrival} disabled={submitting}>
          {submitting ? "Checking in…" : "I'm here"}
        </button>
      </div>
    );
  }

  if (stage === "ready") {
    return (
      <div className="confirm-wrap">
        <div className="confirm-icon">✓</div>
        <h2>You're pre-registered</h2>
        <p className="helper-text">
          When you arrive, open this same link again and tap "I'm here" to check in.
        </p>
      </div>
    );
  }

  if (stage === "arrived") {
    return (
      <div className="confirm-wrap">
        <div className="confirm-icon">✓</div>
        <h2>You're checked in</h2>
        <p className="helper-text">Your host has been informed and will be with you soon.</p>
      </div>
    );
  }

  // status === "invited" -> collect the visitor's own details first.
  if (stage === "details") {
    return (
      <div>
        <h3>Complete your pre-registration</h3>
        <label htmlFor="ck-full-name">Full name</label>
        <input
          id="ck-full-name"
          type="text"
          value={values.full_name}
          onChange={(e) => setValues({ ...values, full_name: e.target.value })}
        />
        <label htmlFor="ck-phone">Phone</label>
        <input
          id="ck-phone"
          type="tel"
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
        />
        <label htmlFor="ck-company">Company / organization</label>
        <input
          id="ck-company"
          type="text"
          value={values.company}
          onChange={(e) => setValues({ ...values, company: e.target.value })}
        />

        {visitor?.proposed_time_slots?.length > 0 && (
          <div>
            <TimeSlotChooser
              slots={visitor.proposed_time_slots}
              value={values.selected_time_slot}
              onChange={(iso) =>
                setValues({ ...values, selected_time_slot: iso, proposed_alternative_time: "" })
              }
            />
            <ProposeTimeForm
              value={values.proposed_alternative_time}
              onChange={(iso) =>
                setValues({ ...values, proposed_alternative_time: iso, selected_time_slot: iso ? "" : values.selected_time_slot })
              }
              label="Propose a different time"
            />
          </div>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
          <input
            type="checkbox"
            checked={values.is_group}
            onChange={(e) =>
              setValues({
                ...values,
                is_group: e.target.checked,
                additional_visitor_count: e.target.checked && !isStructuredType ? values.additional_visitor_count || "1" : "",
                group_members: e.target.checked && isStructuredType ? (values.group_members.length ? values.group_members : [emptyMember()]) : [],
              })
            }
            style={{ width: 16, height: 16 }}
          />
          <span style={{ fontWeight: 400, color: "var(--ink)", textTransform: "none", fontSize: "0.9rem" }}>
            I'm bringing others with me
          </span>
        </label>

        {values.is_group && isStructuredType && (
          <div>
            <p className="helper-text" style={{ marginTop: 12, marginBottom: 6 }}>
              Add each additional person's name and phone number.
            </p>
            {values.group_members.map((m, i) => (
              <div key={i} className="row-2" style={{ alignItems: "flex-end" }}>
                <div>
                  <label htmlFor={`ck-gm-name-${i}`}>{`Person ${i + 1} name`}</label>
                  <input
                    id={`ck-gm-name-${i}`}
                    type="text"
                    value={m.name}
                    onChange={(e) => updateMember(i, "name", e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor={`ck-gm-phone-${i}`}>Phone</label>
                    <input
                      id={`ck-gm-phone-${i}`}
                      type="tel"
                      value={m.phone}
                      onChange={(e) => updateMember(i, "phone", e.target.value)}
                      placeholder="Phone number"
                    />
                  </div>
                  {values.group_members.length > 1 && (
                    <button type="button" className="btn-small" onClick={() => removeMember(i)} style={{ marginBottom: 2 }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" className="btn-small" onClick={addMember} style={{ marginTop: 4 }}>
              + Add another person
            </button>
          </div>
        )}

        {values.is_group && !isStructuredType && (
          <div>
            <label htmlFor="ck-group-count">How many additional visitors?</label>
            <input
              id="ck-group-count"
              type="text"
              inputMode="numeric"
              value={values.additional_visitor_count}
              onChange={(e) => setValues({ ...values, additional_visitor_count: e.target.value })}
              placeholder="e.g. 2"
            />
            <label htmlFor="ck-group-names">Their names (optional)</label>
            <textarea
              id="ck-group-names"
              rows={2}
              value={values.additional_visitor_names}
              onChange={(e) => setValues({ ...values, additional_visitor_names: e.target.value })}
              placeholder="One name per line, or comma-separated"
            />
          </div>
        )}

        <div className="nda-box">{VISITOR_AGREEMENT_TEXT}</div>

        <button
          className="btn btn-primary"
          onClick={completePreregistration}
          disabled={
            submitting ||
            !values.full_name.trim() ||
            (visitor?.proposed_time_slots?.length > 0 &&
              !values.selected_time_slot &&
              !values.proposed_alternative_time) ||
            (values.is_group &&
              isStructuredType &&
              !(values.group_members.length > 0 && values.group_members.every((m) => m.name.trim() && m.phone.trim())))
          }
        >
          {submitting ? "Registering…" : "Register"}
        </button>
      </div>
    );
  }

  return null;
}

export default function CheckinPage() {
  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader />
      </div>
      <div className="card">
        <Suspense fallback={<p className="helper-text">Loading…</p>}>
          <CheckinInner />
        </Suspense>
      </div>
    </main>
  );
}
