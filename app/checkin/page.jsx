"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AgreementStep from "@/components/AgreementStep";
import BrandHeader from "@/components/BrandHeader";
import TimeSlotChooser from "@/components/TimeSlotChooser";
import ProposeTimeForm from "@/components/ProposeTimeForm";

function CheckinInner() {
  const token = useSearchParams().get("token");
  const [loading, setLoading] = useState(true);
  const [visitor, setVisitor] = useState(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("details"); // details -> agreement -> arrived
  const [values, setValues] = useState({
    full_name: "",
    phone: "",
    company: "",
    is_group: false,
    additional_visitor_count: "",
    additional_visitor_names: "",
    selected_time_slot: "",
    proposed_alternative_time: "",
  });
  const [submitting, setSubmitting] = useState(false);

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
          selected_time_slot: d.visitor.selected_time_slot || "",
          proposed_alternative_time: d.visitor.proposed_alternative_time || "",
        });
        if (d.visitor.status === "checked_in") setStage("arrived");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

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
          additional_visitor_names: values.is_group ? values.additional_visitor_names : "",
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
        <label>Full name</label>
        <input
          type="text"
          value={values.full_name}
          onChange={(e) => setValues({ ...values, full_name: e.target.value })}
        />
        <label>Phone</label>
        <input
          type="tel"
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
        />
        <label>Company / organization</label>
        <input
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
              label="None of these work — propose a different time"
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
                additional_visitor_count: e.target.checked ? values.additional_visitor_count || "1" : "",
              })
            }
            style={{ width: 16, height: 16 }}
          />
          <span style={{ fontWeight: 400, color: "var(--ink)", textTransform: "none", fontSize: "0.9rem" }}>
            I'm bringing others with me
          </span>
        </label>

        {values.is_group && (
          <div>
            <label>How many additional visitors?</label>
            <input
              type="text"
              inputMode="numeric"
              value={values.additional_visitor_count}
              onChange={(e) => setValues({ ...values, additional_visitor_count: e.target.value })}
              placeholder="e.g. 2"
            />
            <label>Their names (optional)</label>
            <textarea
              rows={2}
              value={values.additional_visitor_names}
              onChange={(e) => setValues({ ...values, additional_visitor_names: e.target.value })}
              placeholder="One name per line, or comma-separated"
            />
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={() => setStage("agreement")}
          disabled={
            !values.full_name.trim() ||
            (visitor?.proposed_time_slots?.length > 0 &&
              !values.selected_time_slot &&
              !values.proposed_alternative_time)
          }
        >
          Continue
        </button>
      </div>
    );
  }

  if (stage === "agreement") {
    return (
      <div>
        <h3>Agree to the visitor terms</h3>
        <AgreementStep onAgree={completePreregistration} submitting={submitting} />
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
